import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PrecioPizarra } from "../entities/precio-pizarra.entity";

/** Cereales con tablero en la pizarra CAC (claves normalizadas sin acentos). */
export const CEREALES_PIZARRA = [
  "soja",
  "girasol",
  "maiz",
  "trigo",
  "sorgo",
] as const;

export type CerealPizarra = (typeof CEREALES_PIZARRA)[number];

/** "Maíz tardío" → "maiz tardio", "Soja 1º" → "soja 1º". */
export function normalizarNombre(nombre: string): string {
  return (nombre ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Matchea un nombre de cultivo o de tablero ("Soja 1º", "Maíz", "trigo pan")
 * con su cereal de pizarra. Por contenido y no por igualdad exacta, porque
 * tanto la CAC como los cultivos cargados usan variantes ("1º", "2da", etc.).
 */
export function cerealDeCultivo(nombre: string): CerealPizarra | null {
  const n = normalizarNombre(nombre);
  for (const cereal of CEREALES_PIZARRA) {
    if (n.includes(cereal)) return cereal;
  }
  return null;
}

export interface PrecioCereal {
  cultivo: string;
  /** $/Tn. NULL cuando el tablero marca S/C sin estimado. */
  precioArs: number | null;
  /** US$/Tn informativo. */
  precioUsd: number | null;
  estimado: boolean;
  sinCotizacion: boolean;
}

export interface Pizarra {
  /** Fecha publicada por la CAC (DD/MM/YYYY) o NULL si no se pudo parsear. */
  fechaPizarra: string | null;
  tcBna: number | null;
  precios: PrecioCereal[];
  fuente: "scrape" | "cache" | "db";
  actualizadoEn: string;
}

interface CacheEntry {
  valor: Pizarra;
  expira: number;
}

/**
 * Scraping controlado de https://cac.bcr.com.ar/es/precios-de-pizarra
 * (la CAC no expone API).
 *
 * El HTML es simple y estructurado: un `.board.board-{cereal}` por producto
 * con el precio en `$` y `US$`, más la fecha de pizarra y el TC BNA en el
 * pie. Se parsea con regex (sin dependencias nuevas) y se cachea en memoria
 * 6h (la pizarra actualiza una vez por día). Cada scraping exitoso se
 * persiste en `precio_pizarra` como snapshot para fallback e histórico.
 */
@Injectable()
export class PizarraService {
  private readonly logger = new Logger(PizarraService.name);
  private readonly URL = "https://cac.bcr.com.ar/es/precios-de-pizarra";
  private readonly TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
  private cache: CacheEntry | null = null;

  constructor(
    @InjectRepository(PrecioPizarra)
    private precioRepo: Repository<PrecioPizarra>,
  ) {}

  async getPizarra(): Promise<Pizarra> {
    const ahora = Date.now();
    if (this.cache && this.cache.expira > ahora) {
      return { ...this.cache.valor, fuente: "cache" };
    }
    try {
      const html = await this.fetchHtml();
      const pizarra = this.parseHtml(html);
      this.cache = { valor: pizarra, expira: ahora + this.TTL_MS };
      // Snapshot best-effort: no debe romper la respuesta si la BD falla.
      await this.guardarSnapshot(pizarra).catch((e) =>
        this.logger.warn(`No se pudo guardar snapshot de pizarra: ${e}`),
      );
      return pizarra;
    } catch (e) {
      this.logger.warn(`Scraping de pizarra falló: ${e}`);
      if (this.cache) return { ...this.cache.valor, fuente: "cache" };
      const fallback = await this.ultimoSnapshot().catch(() => null);
      if (fallback) return fallback;
      throw e;
    }
  }

  /** Mapa cereal → precio vigente (de la pizarra actual o del fallback). */
  async getMapaPrecios(): Promise<Map<string, PrecioCereal>> {
    const pizarra = await this.getPizarra();
    return new Map(pizarra.precios.map((p) => [p.cultivo, p]));
  }

  // -------------------------------------------------------------------------
  // Scraping
  // -------------------------------------------------------------------------
  private async fetchHtml(): Promise<string> {
    const res = await fetch(this.URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GabinoAgrogestion/1.0; monitor interno)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`CAC respondió ${res.status}`);
    return res.text();
  }

  /** Número en formato es-AR ("350.000,00") → number. */
  private parseNumeroEs(raw: string): number | null {
    const n = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  private parseHtml(html: string): Pizarra {
    const fechaMatch = html.match(
      /Precios Pizarra del d[ií]a\s+(\d{2}\/\d{2}\/\d{4})/i,
    );
    const fechaPizarra = fechaMatch ? fechaMatch[1] : null;

    const tcMatch = html.match(
      /TC BNA Divisas<\/strong>\s*Comprador\s+[\d/]+:\s*<strong>\$\s*([\d.,]+)<\/strong>/i,
    );
    const tcBna = tcMatch ? this.parseNumeroEs(tcMatch[1]) : null;

    const precios: PrecioCereal[] = [];
    // Cada tablero empieza con `<div class="board board-{cereal} ...>`.
    const chunks = html.split(/<div class="board board-/);
    for (const chunk of chunks.slice(1)) {
      const keyMatch = chunk.match(/^([\w-]+)/);
      if (!keyMatch) continue;
      // La clase suele ser el cereal (`board-soja`), pero si la CAC la
      // versiona (`board-soja-1`, etc.) se matchea por el nombre visible.
      let cultivo = keyMatch[1].toLowerCase();
      if (!(CEREALES_PIZARRA as readonly string[]).includes(cultivo)) {
        const nombreMatch = chunk
          .slice(0, 500)
          .match(/<h3>\s*<span class="icon"><\/span>\s*([^<]+?)\s*<\/h3>/);
        const porNombre =
          nombreMatch != null ? cerealDeCultivo(nombreMatch[1]) : null;
        if (!porNombre) continue;
        cultivo = porNombre;
      }

      // Solo hasta el indicador de tendencia: evita arrastrar el tablero siguiente.
      const bloque = chunk.split('style="text-align: center;"')[0] ?? chunk;
      // El split consumió `<div class="board board-`, así que el chunk arranca
      // con `{cereal}[ estimative]">...`.
      const estimado =
        /^\w+\s+estimative/.test(chunk.slice(0, 60)) || /\(E\)/.test(bloque);

      const priceDiv = bloque.match(/<div class="price">(.*?)<\/div>/s);
      const priceText = (priceDiv?.[1] ?? "").replace(/<[^>]+>/g, " ");
      const numeros = [...priceText.matchAll(/([\d.,]+)/g)]
        .map((m) => this.parseNumeroEs(m[1]))
        .filter((n): n is number => n !== null);
      const sinCotizacion = /S\/C/.test(priceText);

      const usdMatch = bloque.match(
        /<strong>US\$<\/strong>\s*(?:<span>\s*\(E\)\s*<\/span>)?\s*([\d.,]+)/s,
      );
      const precioUsd = usdMatch ? this.parseNumeroEs(usdMatch[1]) : null;

      if (sinCotizacion && numeros.length === 0) {
        precios.push({
          cultivo,
          precioArs: null,
          precioUsd: null,
          estimado: false,
          sinCotizacion: true,
        });
      } else {
        precios.push({
          cultivo,
          precioArs: numeros.length > 0 ? numeros[0] : null,
          precioUsd,
          estimado,
          sinCotizacion: false,
        });
      }
    }

    if (precios.length === 0) {
      throw new Error("No se encontraron tableros de precios en la página CAC");
    }
    return {
      fechaPizarra,
      tcBna,
      precios,
      fuente: "scrape",
      actualizadoEn: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Snapshots en BD (fallback + histórico)
  // -------------------------------------------------------------------------
  private async guardarSnapshot(pizarra: Pizarra): Promise<void> {
    const fecha = this.toIsoDate(pizarra.fechaPizarra) ?? this.hoyIso();
    for (const p of pizarra.precios) {
      await this.precioRepo.upsert(
        {
          cultivo: p.cultivo,
          precioArs: p.precioArs,
          precioUsd: p.precioUsd,
          fechaPizarra: fecha,
          estimado: p.estimado,
          sinCotizacion: p.sinCotizacion,
          tcBna: pizarra.tcBna,
        },
        ["cultivo", "fechaPizarra"],
      );
    }
  }

  /** Último snapshot agrupado por cereal (uno por cultivo, el más reciente). */
  private async ultimoSnapshot(): Promise<Pizarra | null> {
    const filas = await this.precioRepo
      .createQueryBuilder("p")
      .distinctOn(["p.cultivo"])
      .orderBy("p.cultivo")
      .addOrderBy("p.fecha_pizarra", "DESC")
      .addOrderBy("p.created_at", "DESC")
      .getMany();
    if (filas.length === 0) return null;
    return {
      fechaPizarra: this.toEsDate(filas[0].fechaPizarra),
      tcBna: filas[0].tcBna != null ? Number(filas[0].tcBna) : null,
      precios: filas.map((f) => ({
        cultivo: f.cultivo,
        precioArs: f.precioArs != null ? Number(f.precioArs) : null,
        precioUsd: f.precioUsd != null ? Number(f.precioUsd) : null,
        estimado: f.estimado,
        sinCotizacion: f.sinCotizacion,
      })),
      fuente: "db",
      actualizadoEn: new Date().toISOString(),
    };
  }

  private toIsoDate(fechaEs: string | null): string | null {
    if (!fechaEs) return null;
    const m = fechaEs.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }

  private toEsDate(fechaIso: string): string | null {
    const m = fechaIso?.match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
  }

  private hoyIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
