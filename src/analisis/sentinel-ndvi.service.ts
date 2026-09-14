import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { inflateRawSync, inflateSync } from "zlib";
import { NdviCacheProvider, NDVI_CACHE } from "./ndvi-cache.provider";
import { CdseAuthService } from "./cdse-auth.service";
import { Anillo, bboxDe, puntoEnAnillo } from "./lote-geo.util";
import { NdviStats } from "./ndvi-tipos";

const PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";
const COLECCION = "sentinel-2-l2a";
const TTL_HISTORICO_MS = 7 * 24 * 60 * 60 * 1000; // escenas pasadas: inmutables
const TTL_RECIENTE_MS = 24 * 60 * 60 * 1000;
const PIXEL_M = 20; // resolución objetivo (bandas rojizas de S2: 20 m)
const LADO_MIN = 64;
const LADO_MAX = 512;

/**
 * NDVI = (B08 - B04) / (B08 + B04) sobre Sentinel-2 L2A (atmosfera-corregida).
 * Banda 2 = máscara válida: 1 sólo si hay dato (dataMask) y el píxel es
 * suelo/vegetación/agua según SCL (afuera nubes, sombras, nieve y cirrus).
 * La API devuelve el raster (TIFF float32 de 2 bandas); las estadísticas se
 * calculan acá píxel a píxel dentro del polígono (el header x-process-stats
 * no lo expone esta instancia de CDSE).
 */
const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask", "SCL"],
    output: { bands: 2, sampleType: "FLOAT32" },
  };
}
function evaluatePixel(samples) {
  const ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04);
  const scl = samples.SCL;
  const suelo = scl === 4 || scl === 5 || scl === 6 || scl === 7;
  return [ndvi, samples.dataMask === 1 && suelo ? 1 : 0];
}`;

interface BandaStats {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdev?: number;
  sum?: number;
  percentiles?: number[]; // UNIFORM_PERCENTILES: 101 valores (0–100)
}

interface ProcessStatsHeader {
  bands?: Record<string, BandaStats>;
  inputs?: Record<string, { count?: number; coverage?: number }>;
  input?: Record<string, { count?: number; coverage?: number }>;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

@Injectable()
export class SentinelNdviService {
  private readonly logger = new Logger(SentinelNdviService.name);
  private readonly inflight = new Map<string, Promise<NdviStats | null>>();

  constructor(
    private readonly auth: CdseAuthService,
    private readonly config: ConfigService,
    @Inject(NDVI_CACHE) private readonly cache: NdviCacheProvider,
  ) {}

  get habilitado(): boolean {
    return this.auth.habilitado;
  }

  /**
   * NDVI agregado del polígono para una ventana de tiempo (el mosaico de la
   * escena más reciente con menos nubes dentro de la ventana). Devuelve null
   * si no hay credenciales, no hay escenas limpias o la fuente falla: quien
   * llama decide el fallback (GIBS).
   */
  async getStats(
    anillo: Anillo,
    start: Date,
    end: Date,
  ): Promise<NdviStats | null> {
    if (!this.auth.habilitado || anillo.length < 4) return null;

    const key = this.clave(anillo, start, end);
    const cached = this.cache.get(key);
    if (cached) return JSON.parse(cached) as NdviStats;

    const enVuelo = this.inflight.get(key);
    if (enVuelo) return enVuelo;

    const promesa = this.fetchStats(anillo, start, end)
      .then((stats) => {
        if (stats) this.cache.set(key, JSON.stringify(stats), this.ttl(end));
        return stats;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promesa);
    return promesa;
  }

  private async fetchStats(
    anillo: Anillo,
    start: Date,
    end: Date,
  ): Promise<NdviStats | null> {
    const token = await this.auth.getToken();
    if (!token) return null;

    const { ancho, alto } = this.lados(anillo);
    const maxCloud = Number(
      this.config.get<string>("S2_MAX_CLOUD_PERCENT") || "40",
    );

    const cuerpo = {
      input: {
        bounds: {
          // geometry va al mismo nivel que bbox/properties, NO dentro de properties
          properties: {
            crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
          },
          geometry: { type: "Polygon", coordinates: [anillo] },
        },
        data: [
          {
            type: COLECCION,
            dataFilter: {
              timeRange: { from: start.toISOString(), to: end.toISOString() },
              maxCloudCoverage: maxCloud,
            },
          },
        ],
      },
      output: {
        width: ancho,
        height: alto,
        // TIFF porque PNG no admite bandas FLOAT32; el raster se decodifica
        // acá para las estadísticas (esta instancia no expone x-process-stats)
        responses: [{ identifier: "default", format: { type: "image/tiff" } }],
      },
      // processing es de nivel raíz (hermano de input/output), no va dentro de input
      processing: {
        upsampling: "NEAREST",
        downsampling: "NEAREST",
      },
      // evalscript también es de nivel raíz; "custom.evalscript" da 400
      evalscript: EVALSCRIPT,
    };
    try {
      const res = await fetch(PROCESS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const detalle = await res.text().catch(() => "");
        this.logger.warn(
          `CDSE Process API respondió ${res.status}: ${detalle.slice(0, 240)}`,
        );
        return null;
      }

      // Fast-path si alguna instancia expone el header; si no, se decodifica
      // el raster TIFF (2 bandas float32: NDVI + máscara válida).
      const header = res.headers.get("x-process-stats");
      if (header) {
        try {
          const porHeader = this.parseStats(
            JSON.parse(header) as ProcessStatsHeader,
          );
          if (porHeader) return porHeader;
        } catch {
          // cae al decode del raster
        }
      }
      const tiff = Buffer.from(await res.arrayBuffer());
      return this.statsDesdeTiff(tiff, anillo);
    } catch (e) {
      this.logger.warn(`CDSE Process API falló: ${(e as Error).message}`);
      return null;
    }
  }

  private parseStats(s: ProcessStatsHeader): NdviStats | null {
    const entrada = s.inputs?.[COLECCION] ?? s.input?.[COLECCION];
    const escenas = entrada?.count ?? 0;
    if (escenas === 0) return null; // sin escenas bajo el umbral de nubes

    const ndvi = s.bands?.["0"];
    if (!ndvi || ndvi.mean == null) return null;
    const mask = s.bands?.["1"];

    const pct = ndvi.percentiles;
    return {
      fuente: "sentinel-2",
      ndviMedia: round3(ndvi.mean),
      min: ndvi.min != null ? round3(ndvi.min) : null,
      max: ndvi.max != null ? round3(ndvi.max) : null,
      p10: pct?.length ? round3(pct[10]) : null,
      p50: pct?.length
        ? round3(pct[50])
        : ndvi.median != null
          ? round3(ndvi.median)
          : null,
      p90: pct?.length ? round3(pct[90]) : null,
      desvioStd: ndvi.stdev != null ? round3(ndvi.stdev) : null,
      coberturaPct: mask?.mean != null ? round3(mask.mean * 100) : null,
      pixeles: mask?.sum != null ? Math.round(mask.sum) : null,
      escenas,
    };
  }

  /**
   * Estadísticas zonales decodificando el TIFF float32 de 2 bandas
   * (NDVI + máscara). La imagen cubre el bbox de la geometría: se mapean los
   * píxeles a lng/lat y se promedian sólo los que caen dentro del polígono,
   * con máscara válida (dato + SCL de suelo) y NDVI finito.
   */
  private statsDesdeTiff(buf: Buffer, anillo: Anillo): NdviStats | null {
    try {
      const le = buf[0] === 0x49 && buf[1] === 0x49;
      const be = buf[0] === 0x4d && buf[1] === 0x4d;
      if (!le && !be) return null;
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const u16 = (o: number): number => dv.getUint16(o, le);
      const u32 = (o: number): number => dv.getUint32(o, le);
      if (u16(2) !== 42) return null;
      const ifd = u32(4);
      const n = u16(ifd);
      const tags = new Map<number, { typ: number; cnt: number; off: number }>();
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        tags.set(u16(e), { typ: u16(e + 2), cnt: u32(e + 4), off: e + 8 });
      }
      const lista = (tag: number): number[] => {
        const t = tags.get(tag);
        if (!t) return [];
        const tam = t.typ === 3 ? 2 : t.typ === 4 ? 4 : 0;
        if (!tam) return [];
        const off = tam * t.cnt <= 4 ? t.off : u32(t.off);
        const out: number[] = [];
        for (let i = 0; i < t.cnt; i++) {
          out.push(t.typ === 3 ? u16(off + i * 2) : u32(off + i * 4));
        }
        return out;
      };
      const uno = (tag: number, dflt: number): number => lista(tag)[0] ?? dflt;

      const ancho = uno(256, 0);
      const alto = uno(257, 0);
      if (!ancho || !alto || ancho > LADO_MAX || alto > LADO_MAX) return null;
      if (uno(277, 0) !== 2 || uno(284, 1) !== 1) return null; // 2 bandas, chunky
      if (!lista(258).every((b) => b === 32)) return null; // float32
      if (!lista(339).every((s) => s === 3)) return null; // IEEEFP
      const comp = uno(259, 1);
      if (comp !== 1 && comp !== 8 && comp !== 32946) return null;

      const filasPorTira = uno(278, alto);
      const offsets = lista(273);
      const tamanios = lista(279);
      if (!offsets.length || offsets.length !== tamanios.length) return null;

      const bandas = ancho * 2;
      const img = new Float32Array(ancho * alto * 2);
      const tiras = Math.ceil(alto / filasPorTira);
      for (let s = 0; s < tiras && s < offsets.length; s++) {
        let raw = buf.subarray(offsets[s], offsets[s] + tamanios[s]);
        if (comp !== 1) {
          try {
            raw = inflateSync(raw);
          } catch {
            try {
              raw = inflateRawSync(raw);
            } catch {
              return null;
            }
          }
        }
        const filas = Math.min(filasPorTira, alto - s * filasPorTira);
        if (raw.length < filas * bandas * 4) return null;
        const rdv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        for (let r = 0; r < filas; r++) {
          for (let c = 0; c < bandas; c++) {
            img[(s * filasPorTira + r) * bandas + c] = rdv.getFloat32(
              (r * bandas + c) * 4,
              le,
            );
          }
        }
      }

      const bbox = bboxDe(anillo);
      if (!bbox) return null;
      const valores: number[] = [];
      let dentro = 0;
      for (let py = 0; py < alto; py++) {
        const lat =
          bbox.maxLat - ((py + 0.5) / alto) * (bbox.maxLat - bbox.minLat);
        for (let px = 0; px < ancho; px++) {
          const lng =
            bbox.minLng + ((px + 0.5) / ancho) * (bbox.maxLng - bbox.minLng);
          if (!puntoEnAnillo(lng, lat, anillo)) continue;
          dentro++;
          const ndvi = img[(py * ancho + px) * 2];
          const mask = img[(py * ancho + px) * 2 + 1];
          if (Number.isFinite(ndvi) && mask > 0.5) valores.push(ndvi);
        }
      }
      if (!dentro || !valores.length) return null;

      return {
        fuente: "sentinel-2",
        ndviMedia: round3(promedio(valores)),
        min: round3(Math.min(...valores)),
        max: round3(Math.max(...valores)),
        p10: round3(percentil(valores, 10)),
        p50: round3(percentil(valores, 50)),
        p90: round3(percentil(valores, 90)),
        desvioStd: round3(desvioEstandar(valores)),
        coberturaPct: round3((valores.length / dentro) * 100),
        pixeles: valores.length,
        escenas: null, // el raster mosaico no informa nº de escenas
      };
    } catch {
      return null;
    }
  }

  /** Lados de la salida en px, proporcionales al bbox (~PIXEL_M por píxel). */
  private lados(anillo: Anillo): { ancho: number; alto: number } {
    const bbox = bboxDe(anillo);
    if (!bbox) return { ancho: 256, alto: 256 };
    const latMed = (bbox.minLat + bbox.maxLat) / 2;
    const anchoM =
      (bbox.maxLng - bbox.minLng) *
      111_320 *
      Math.cos((latMed * Math.PI) / 180);
    const altoM = (bbox.maxLat - bbox.minLat) * 110_540;
    const lado = (m: number): number =>
      Math.min(LADO_MAX, Math.max(LADO_MIN, Math.round(m / PIXEL_M)));
    return { ancho: lado(anchoM), alto: lado(altoM) };
  }

  private ttl(end: Date): number {
    const umbral = new Date();
    umbral.setDate(umbral.getDate() - 10);
    return end < umbral ? TTL_HISTORICO_MS : TTL_RECIENTE_MS;
  }

  /** Clave estable: polígono simplificado a 4 decimales + ventana. */
  private clave(anillo: Anillo, start: Date, end: Date): string {
    const geo = anillo
      .map(([lng, lat]) => `${lng.toFixed(4)},${lat.toFixed(4)}`)
      .join(";");
    const hash = createHash("sha1").update(geo).digest("hex").slice(0, 16);
    const ymd = (d: Date): string =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `s2|${hash}|${ymd(start)}|${ymd(end)}`;
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
