import { Inject, Injectable, Logger } from "@nestjs/common";
import { POWER_CACHE, PowerCacheProvider } from "./power-cache.provider";

export type PowerParam = "T2M" | "T2M_MAX" | "T2M_MIN" | "RH2M" | "PRECTOTCORR";

/** Dato diario por parámetro: fecha "YYYY-MM-DD" → valor (°C, %, mm) o null. */
export type SerieDiariaPower = Record<
  PowerParam,
  Record<string, number | null>
>;

const POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const PARAMS: PowerParam[] = [
  "T2M",
  "T2M_MAX",
  "T2M_MIN",
  "RH2M",
  "PRECTOTCORR",
];
const PARAMS_STR = PARAMS.join(",");
const FILL = -999;
const FECHA_MIN = new Date("1981-01-01");
const LAG_DIAS = 2; // POWER publica con ~2 días de atraso
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // los datos diarios cambian 1 vez/día

interface PowerDailyResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const round2 = (n: number): number => Math.round(n * 100) / 100;

@Injectable()
export class NasaPowerService {
  private readonly logger = new Logger(NasaPowerService.name);
  /** Dedupe en vuelo: evita duplicar requests concurrentes a una misma key. */
  private readonly inflight = new Map<string, Promise<SerieDiariaPower>>();

  constructor(
    @Inject(POWER_CACHE) private readonly cache: PowerCacheProvider,
  ) {}

  /**
   * Serie diaria de temperatura (media/máx/mín), humedad relativa y lluvia
   * (PRECTOTCORR) para un punto, en el rango [start, end] (ambos locales).
   * La clave de cache usa la coordenada redondeada a 0.01° (~1 km): lotes
   * vecinos (misma celda de MERRA2, ~50 km) comparten el cache.
   */
  async getDaily(
    lat: number,
    lng: number,
    start: Date,
    end: Date,
  ): Promise<SerieDiariaPower> {
    const s = this.clampMin(start);
    const e = this.clampEnd(end);
    if (e < s) return this.vacia();

    const rLat = round2(lat);
    const rLng = round2(lng);
    const key = `${rLat}|${rLng}|${PARAMS_STR}|${ymd(s)}|${ymd(e)}`;

    const cached = this.cache.get(key);
    if (cached) return JSON.parse(cached) as SerieDiariaPower;

    const enVuelo = this.inflight.get(key);
    if (enVuelo) return enVuelo;

    const promesa = this.fetchAndParse(rLat, rLng, s, e)
      .then((data) => {
        this.cache.set(key, JSON.stringify(data), CACHE_TTL_MS);
        return data;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promesa);
    return promesa;
  }

  private async fetchAndParse(
    lat: number,
    lng: number,
    start: Date,
    end: Date,
  ): Promise<SerieDiariaPower> {
    const query = new URLSearchParams({
      parameters: PARAMS_STR,
      community: "AG",
      latitude: String(lat),
      longitude: String(lng),
      start: ymd(start),
      end: ymd(end),
      format: "JSON",
    });

    const res = await fetch(`${POWER_URL}?${query.toString()}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`NASA POWER respondió ${res.status}`);
    }
    const body = (await res.json()) as PowerDailyResponse;
    const parametros = body?.properties?.parameter ?? {};

    const serie = {} as SerieDiariaPower;
    for (const p of PARAMS) {
      const mapa: Record<string, number | null> = {};
      const origen = parametros[p] ?? {};
      for (const [fecha, valor] of Object.entries(origen)) {
        mapa[fecha] = valor === FILL || valor == null ? null : valor;
      }
      serie[p] = mapa;
    }
    return serie;
  }

  private vacia(): SerieDiariaPower {
    return {
      T2M: {},
      T2M_MAX: {},
      T2M_MIN: {},
      RH2M: {},
      PRECTOTCORR: {},
    };
  }

  private clampMin(d: Date): Date {
    return d < FECHA_MIN ? new Date(FECHA_MIN) : d;
  }

  private clampEnd(d: Date): Date {
    const tope = new Date();
    tope.setDate(tope.getDate() - LAG_DIAS);
    return d > tope ? tope : d;
  }
}

/** Fechas presentes en una serie (unión de los 5 parámetros), ordenadas. */
export function fechasDeSerie(serie: SerieDiariaPower): string[] {
  const set = new Set<string>();
  for (const p of PARAMS)
    for (const fecha of Object.keys(serie[p])) set.add(fecha);
  return Array.from(set).sort();
}
