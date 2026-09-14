import { Inject, Injectable, Logger } from "@nestjs/common";
import { inflateSync } from "zlib";
import { createHash } from "crypto";
import { NdviCacheProvider, NDVI_CACHE } from "./ndvi-cache.provider";
import { Anillo, bboxDe, puntoEnAnillo } from "./lote-geo.util";
import { NdviStats } from "./ndvi-tipos";

/**
 * NDVI de NASA GIBS (capa VIIRS_SNPP_NDVI_8Day, WMTS público sin credenciales).
 * Resolución ~500 m: no sirve para variación intra-lote, pero casi nunca tiene
 * huecos de nube (compositivo 8-day) y es el fallback cuando Sentinel-2 no
 * tiene escenas limpias. Se descargan las teselas PNG que cubren el bbox del
 * lote, se decodifica la paleta con el colormap oficial (RGB → rango NDVI) y
 * se promedian sólo los píxeles cuyo centro cae dentro del polígono.
 */
const LAYER = "VIIRS_SNPP_NDVI_8Day";
const TILE_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best";
const COLORMAP_URL =
  "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_NDVI.xml";
const ZOOM = 7;
const TILE_PX = 512;
// Matriz "500m" de GIBS a z=7: 160 columnas × 80 filas (teselas de 512 px
// de 0.00439° ≈ 490 m). En EPSG:4326 el ancho del mundo son 160 teselas.
const COLS = 160;
const ROWS = 80;
const MAX_TILES = 16;
const DIA_MS = 86_400_000;
const TTL_HISTORICO_MS = 7 * 24 * DIA_MS; // compositivos cerrados: inmutables
const TTL_RECIENTE_MS = 24 * DIA_MS;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

interface PngImage {
  ancho: number;
  alto: number;
  rgbEn(x: number, y: number): string | null;
}

@Injectable()
export class GibsNdviService {
  private readonly logger = new Logger(GibsNdviService.name);
  private readonly inflight = new Map<string, Promise<NdviStats | null>>();
  private colormap: Promise<Map<string, number>> | null = null;

  constructor(@Inject(NDVI_CACHE) private readonly cache: NdviCacheProvider) {}

  /** NDVI del último compositivo de 8 días que cierra antes (o toca) a `end`. */
  async getStats(anillo: Anillo, end: Date): Promise<NdviStats | null> {
    if (anillo.length < 4) return null;
    const fecha = this.compositeAnteriorA(end);
    if (!fecha) return null;

    const key = this.clave(anillo, fecha);
    const cached = this.cache.get(key);
    if (cached) return JSON.parse(cached) as NdviStats;

    const enVuelo = this.inflight.get(key);
    if (enVuelo) return enVuelo;

    const promesa = this.calcula(anillo, fecha)
      .then((stats) => {
        if (stats) this.cache.set(key, JSON.stringify(stats), this.ttl(fecha));
        return stats;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promesa);
    return promesa;
  }

  private async calcula(
    anillo: Anillo,
    fecha: Date,
  ): Promise<NdviStats | null> {
    const bbox = bboxDe(anillo);
    if (!bbox) return null;
    const mapa = await this.getColormap();
    if (mapa.size === 0) return null;

    const iso = this.iso(fecha);
    const colMin = this.colX(bbox.minLng);
    const colMax = this.colX(bbox.maxLng);
    const rowMin = this.rowY(bbox.maxLat);
    const rowMax = this.rowY(bbox.minLat);
    if ((colMax - colMin + 1) * (rowMax - rowMin + 1) > MAX_TILES) return null;

    const valores: number[] = [];
    let dentro = 0;
    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        const png = await this.fetchTile(iso, row, col);
        if (!png) continue;
        const img = this.decodePng(png);
        if (!img) continue;
        for (let py = 0; py < img.alto; py++) {
          const lat =
            90 - ((row * TILE_PX + py + 0.5) * 180) / (ROWS * TILE_PX);
          for (let px = 0; px < img.ancho; px++) {
            const lng =
              -180 + ((col * TILE_PX + px + 0.5) * 360) / (COLS * TILE_PX);
            if (!puntoEnAnillo(lng, lat, anillo)) continue;
            dentro++;
            const rgb = img.rgbEn(px, py);
            if (rgb == null) continue;
            const v = mapa.get(rgb);
            if (v != null) valores.push(v);
          }
        }
      }
    }
    if (dentro === 0 || valores.length === 0) return null;

    return {
      fuente: "viirs",
      ndviMedia: round3(promedio(valores)),
      min: round3(Math.min(...valores)),
      max: round3(Math.max(...valores)),
      p10: round3(percentil(valores, 10)),
      p50: round3(percentil(valores, 50)),
      p90: round3(percentil(valores, 90)),
      desvioStd: round3(desvioEstandar(valores)),
      coberturaPct: round3((valores.length / dentro) * 100),
      pixeles: valores.length,
      escenas: 1,
    };
  }

  // -------------------------------------------------------------------------
  // Compositivos 8-day (periodos de 8 días desde el 1º de enero, estilo MOD13)
  // -------------------------------------------------------------------------
  private compositeAnteriorA(fecha: Date): Date | null {
    let d = new Date(fecha);
    for (let i = 0; i < 3; i++) {
      const inicioAnio = new Date(d.getFullYear(), 0, 1);
      const doy = Math.floor((d.getTime() - inicioAnio.getTime()) / DIA_MS) + 1;
      const periodo = Math.floor((doy - 1) / 8);
      const inicio = new Date(d.getFullYear(), 0, 1 + periodo * 8);
      // GIBS publica con demora: si el compositivo aún no cerró, retroceder.
      if (inicio.getTime() + 8 * DIA_MS <= Date.now()) return inicio;
      d = new Date(inicio.getTime() - DIA_MS);
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Teselas y colormap
  // -------------------------------------------------------------------------
  private colX(lng: number): number {
    return Math.max(
      0,
      Math.min(COLS - 1, Math.floor(((lng + 180) / 360) * COLS)),
    );
  }

  private rowY(lat: number): number {
    return Math.max(
      0,
      Math.min(ROWS - 1, Math.floor(((90 - lat) / 180) * ROWS)),
    );
  }

  private async fetchTile(
    iso: string,
    row: number,
    col: number,
  ): Promise<Buffer | null> {
    const url = `${TILE_BASE}/${LAYER}/default/${iso}/500m/${ZOOM}/${row}/${col}.png`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      this.logger.warn(
        `GIBS ${LAYER} ${iso} ${row}/${col} falló: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private async getColormap(): Promise<Map<string, number>> {
    if (!this.colormap) {
      this.colormap = this.fetchColormap().catch((e: Error) => {
        this.logger.warn(`GIBS colormap falló: ${e.message}`);
        this.colormap = null;
        return new Map<string, number>();
      });
    }
    return this.colormap;
  }

  private async fetchColormap(): Promise<Map<string, number>> {
    const res = await fetch(COLORMAP_URL, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`colormap respondió ${res.status}`);
    const xml = await res.text();
    const mapa = new Map<string, number>();
    for (const m of xml.matchAll(/<ColorMapEntry\b[^>]*\/?>/g)) {
      const tag = m[0];
      const rgb = /rgb="([\d,\s]+)"/.exec(tag)?.[1];
      const val = /value="\[([-\d.]+),([-\d.]+)\)"/.exec(tag);
      const transparent = /transparent="true"/.test(tag);
      const nodata = /nodata="true"/.test(tag);
      if (!rgb || !val || transparent || nodata) continue;
      const [lo, hi] = [Number(val[1]), Number(val[2])];
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
      mapa.set(rgb.replace(/\s+/g, ""), (lo + hi) / 2);
    }
    return mapa;
  }

  // -------------------------------------------------------------------------
  // Decoder PNG mínimo (8 bits, sin interlace; paleta/RGB/grayscale)
  // -------------------------------------------------------------------------
  private decodePng(buf: Buffer): PngImage | null {
    try {
      if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
      let pos = 8;
      let ancho = 0;
      let alto = 0;
      let bitDepth = 0;
      let colorType = 0;
      let interlace = 0;
      let palette: Buffer | null = null;
      const idat: Buffer[] = [];
      while (pos + 8 <= buf.length) {
        const len = buf.readUInt32BE(pos);
        const tipo = buf.toString("ascii", pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (tipo === "IHDR") {
          ancho = data.readUInt32BE(0);
          alto = data.readUInt32BE(4);
          bitDepth = data[8];
          colorType = data[9];
          interlace = data[12];
        } else if (tipo === "PLTE") {
          palette = Buffer.from(data);
        } else if (tipo === "IDAT") {
          idat.push(Buffer.from(data));
        }
        pos += 12 + len;
      }
      if (bitDepth !== 8 || interlace !== 0) return null;
      const canales = { 0: 1, 3: 1, 4: 2, 2: 3, 6: 4 }[colorType];
      if (!canales || (colorType === 3 && !palette)) return null;

      const raw = inflateSync(Buffer.concat(idat));
      const stride = ancho * canales;
      const out = Buffer.alloc(alto * stride);
      for (let y = 0; y < alto; y++) {
        const base = y * (stride + 1);
        const filtro = raw[base];
        const dst = y * stride;
        const prev = dst - stride;
        for (let x = 0; x < stride; x++) {
          const cruda = raw[base + 1 + x];
          const a = x >= canales ? out[dst + x - canales] : 0;
          const b = y > 0 ? out[prev + x] : 0;
          const c = y > 0 && x >= canales ? out[prev + x - canales] : 0;
          let v = cruda;
          if (filtro === 1) v = cruda + a;
          else if (filtro === 2) v = cruda + b;
          else if (filtro === 3) v = cruda + ((a + b) >> 1);
          else if (filtro === 4) {
            const p = a + b - c;
            const pa = Math.abs(p - a);
            const pb = Math.abs(p - b);
            const pc = Math.abs(p - c);
            v = cruda + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          }
          out[dst + x] = v & 255;
        }
      }

      return {
        ancho,
        alto,
        rgbEn: (x, y) => {
          const i = y * stride + x * canales;
          if (colorType === 3) {
            const idx = out[i] * 3;
            return `${palette![idx]},${palette![idx + 1]},${palette![idx + 2]}`;
          }
          if (colorType === 2 || colorType === 6) {
            return `${out[i]},${out[i + 1]},${out[i + 2]}`;
          }
          return `${out[i]},${out[i]},${out[i]}`; // 0 y 4 (grayscale ± alfa)
        },
      };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------------------------
  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private ttl(fechaCompositiva: Date): number {
    return fechaCompositiva.getTime() + 8 * DIA_MS < Date.now()
      ? TTL_HISTORICO_MS
      : TTL_RECIENTE_MS;
  }

  private clave(anillo: Anillo, fecha: Date): string {
    const geo = anillo
      .map(([lng, lat]) => `${lng.toFixed(4)},${lat.toFixed(4)}`)
      .join(";");
    const hash = createHash("sha1").update(geo).digest("hex").slice(0, 16);
    return `gibs|${LAYER}|${hash}|${this.iso(fecha)}`;
  }
}

function promedio(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function desvioEstandar(v: number[]): number {
  if (v.length < 2) return 0;
  const mu = promedio(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1));
}

function percentil(v: number[], p: number): number {
  const s = [...v].sort((a, b) => a - b);
  const idx = (s.length - 1) * (p / 100);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
