import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Lote } from "../entities/lote.entity";
import { Roles } from "src/constantes";
import {
  fechasDeSerie,
  NasaPowerService,
  type SerieDiariaPower,
} from "./nasa-power.service";

export type PeriodoClima = "actual" | "mes" | "campania";

export interface DiaClima {
  fecha: string; // "YYYY-MM-DD"
  tMedia: number | null;
  tMax: number | null;
  tMin: number | null;
  hr: number | null;
  lluvia: number | null;
  gdd: number | null;
}

export interface AgregadosClima {
  tMedia: number | null;
  tMaxMedia: number | null;
  tMaxAbs: number | null;
  tMinMedia: number | null;
  tMinAbs: number | null;
  hrMedia: number | null;
  lluviaTotal: number | null;
  lluviaDiariaMedia: number | null;
  gddPeriodo: number | null;
  diasConDatos: number;
}

export interface FilaSerieAnual {
  anio: number;
  tMedia: number | null;
  tMax: number | null;
  tMin: number | null;
  hr: number | null;
  lluvia: number | null;
  gddMes: number | null;
}

export interface RespuestaClima {
  lote: {
    id: number;
    descripcion: string | null;
    campoNombre: string | null;
    empresaNombre: string | null;
    centroide: { lat: number; lng: number } | null;
  };
  periodo: PeriodoClima;
  campania: string | null;
  agregados: AgregadosClima;
  serie: DiaClima[];
  serieAnual: FilaSerieAnual[] | null;
}

const BASE_GDD = 10; // GDD base 10 °C (convención de cultivos templados)

const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const media = (vals: Array<number | null>): number | null => {
  const limpias = vals.filter((v): v is number => v != null);
  if (limpias.length === 0) return null;
  return limpias.reduce((a, b) => a + b, 0) / limpias.length;
};

const suma = (vals: Array<number | null>): number | null => {
  const limpias = vals.filter((v): v is number => v != null);
  if (limpias.length === 0) return null;
  return limpias.reduce((a, b) => a + b, 0);
};

const gddDiario = (tMax: number | null, tMin: number | null): number | null => {
  if (tMax == null || tMin == null) return null;
  return Math.max(0, (tMax + tMin) / 2 - BASE_GDD);
};

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

@Injectable()
export class AnalisisService {
  constructor(
    @InjectRepository(Lote) private readonly loteRepo: Repository<Lote>,
    private readonly power: NasaPowerService,
  ) {}

  async clima(
    idLote: number,
    user: any,
    periodoRaw?: string,
    fecha?: string,
  ): Promise<RespuestaClima> {
    const periodo = this.normalizarPeriodo(periodoRaw);

    const lote = await this.loteRepo.findOne({
      where: { id: idLote },
      relations: ["campo", "empresa"],
    });
    if (!lote) throw new NotFoundException("Lote no encontrado");

    const isAdmin =
      user?.roles?.includes(Roles.SYS_ADMIN) ||
      user?.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user?.idEmpresas || []).map((e: any) =>
      Number(e),
    );
    if (!isAdmin && !userEmpresas.includes(lote.idEmpresa)) {
      Logger.warn(
        `[analisis] 403: lote ${idLote} (empresa ${lote.idEmpresa}) no accesible ` +
          `para uid=${user?.id} roles=${JSON.stringify(user?.roles ?? [])} ` +
          `idEmpresas=${JSON.stringify(userEmpresas)}`,
        AnalisisService.name,
      );
      throw new ForbiddenException(
        `No tiene permisos para el lote ${idLote} (empresa ${lote.idEmpresa})`,
      );
    }

    const centro = this.centroide(lote);
    if (!centro) {
      throw new BadRequestException(
        "El lote no tiene coordenadas para consultar el clima",
      );
    }

    const ventana = this.resolverVentana(periodo, fecha);
    const serie = await this.power.getDaily(
      centro.lat,
      centro.lng,
      ventana.start,
      ventana.end,
    );

    const dias = this.diasDesdeSerie(serie);
    const agregados = this.agregar(dias);

    const filas = dias.map((d) => ({
      fecha: d.fecha,
      tMedia: round1(d.tMedia ?? NaN) as number | null,
      tMax: round1(d.tMax ?? NaN) as number | null,
      tMin: round1(d.tMin ?? NaN) as number | null,
      hr: round1(d.hr ?? NaN) as number | null,
      lluvia: round2(d.lluvia ?? NaN) as number | null,
      gdd: round1(d.gdd ?? NaN) as number | null,
    }));

    const granMensual = periodo === "campania";
    const serieOutput = granMensual ? this.agruparMensual(dias) : filas;

    let serieAnual: FilaSerieAnual[] | null = null;
    if (periodo === "mes" && ventana.mesParaSerieAnual) {
      serieAnual = await this.serieAnual(
        centro.lat,
        centro.lng,
        ventana.mesParaSerieAnual.anio,
        ventana.mesParaSerieAnual.mes,
      );
    }

    return {
      lote: {
        id: lote.id,
        descripcion: lote.descripcion || null,
        campoNombre: lote.campo?.nombre ?? null,
        empresaNombre: lote.empresa?.nombre ?? null,
        centroide: centro,
      },
      periodo,
      campania: ventana.campania ?? null,
      agregados: {
        tMedia: round1(agregados.tMedia ?? NaN) as number | null,
        tMaxMedia: round1(agregados.tMaxMedia ?? NaN) as number | null,
        tMaxAbs: round1(agregados.tMaxAbs ?? NaN) as number | null,
        tMinMedia: round1(agregados.tMinMedia ?? NaN) as number | null,
        tMinAbs: round1(agregados.tMinAbs ?? NaN) as number | null,
        hrMedia: round1(agregados.hrMedia ?? NaN) as number | null,
        lluviaTotal: round2(agregados.lluviaTotal ?? NaN) as number | null,
        lluviaDiariaMedia: round2(agregados.lluviaDiariaMedia ?? NaN) as
          | number
          | null,
        gddPeriodo: round1(agregados.gddPeriodo ?? NaN) as number | null,
        diasConDatos: agregados.diasConDatos,
      },
      serie: serieOutput,
      serieAnual,
    };
  }

  // -------------------------------------------------------------------------
  // Ventanas por período
  // -------------------------------------------------------------------------
  private normalizarPeriodo(raw?: string): PeriodoClima {
    const p = (raw || "actual") as PeriodoClima;
    if (!["actual", "mes", "campania"].includes(p)) {
      throw new BadRequestException(
        "periodo inválido: use actual | mes | campania",
      );
    }
    return p;
  }

  private resolverVentana(
    periodo: PeriodoClima,
    fecha?: string,
  ): {
    start: Date;
    end: Date;
    campania: string | null;
    mesParaSerieAnual: { anio: number; mes: number } | null;
  } {
    const hoy = new Date();

    if (periodo === "actual") {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { start, end: hoy, campania: null, mesParaSerieAnual: null };
    }

    if (periodo === "mes") {
      const { anio, mes } = this.parseMes(fecha);
      return {
        start: new Date(anio, mes - 1, 1),
        end: new Date(anio, mes, 0),
        campania: null,
        mesParaSerieAnual: { anio, mes },
      };
    }

    const campania = this.normalizarCampania(fecha);
    const anioInicio = 2000 + Number(campania.split("/")[0]);
    const start = new Date(anioInicio, 6, 1); // 1º de julio
    return { start, end: hoy, campania, mesParaSerieAnual: null };
  }

  private parseMes(fecha?: string): { anio: number; mes: number } {
    if (fecha && /^\d{4}-\d{2}$/.test(fecha)) {
      const [a, m] = fecha.split("-").map(Number);
      if (m >= 1 && m <= 12) return { anio: a, mes: m };
    }
    const ahora = new Date();
    return { anio: ahora.getFullYear(), mes: ahora.getMonth() + 1 };
  }

  private normalizarCampania(fecha?: string): string {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const inicio = hoy.getMonth() >= 6 ? y : y - 1;
    const defaultCamp = `${String(inicio % 100).padStart(2, "0")}/${String(
      (inicio + 1) % 100,
    ).padStart(2, "0")}`;

    if (fecha && /^\d{2}\/\d{2}$/.test(fecha)) {
      const [a, b] = fecha.split("/").map(Number);
      if (b === (a + 1) % 100) return fecha;
    }
    return defaultCamp;
  }

  // -------------------------------------------------------------------------
  // Cálculos
  // -------------------------------------------------------------------------
  private diasDesdeSerie(serie: SerieDiariaPower): DiaClima[] {
    return fechasDeSerie(serie).map((fecha) => {
      const tMedia = numero(serie.T2M[fecha]);
      const tMax = numero(serie.T2M_MAX[fecha]);
      const tMin = numero(serie.T2M_MIN[fecha]);
      const hr = numero(serie.RH2M[fecha]);
      const lluvia = numero(serie.PRECTOTCORR[fecha]);
      return {
        fecha,
        tMedia,
        tMax,
        tMin,
        hr,
        lluvia,
        gdd: gddDiario(tMax, tMin),
      };
    });
  }

  private agregar(dias: DiaClima[]): AgregadosClima {
    const tMaxAbs = Math.max(
      ...dias.map((d) => d.tMax ?? -Infinity),
      -Infinity,
    );
    const tMinAbs = Math.min(...dias.map((d) => d.tMin ?? Infinity), Infinity);

    return {
      tMedia: media(dias.map((d) => d.tMedia)),
      tMaxMedia: media(dias.map((d) => d.tMax)),
      tMaxAbs: Number.isFinite(tMaxAbs) ? tMaxAbs : null,
      tMinMedia: media(dias.map((d) => d.tMin)),
      tMinAbs: Number.isFinite(tMinAbs) ? tMinAbs : null,
      hrMedia: media(dias.map((d) => d.hr)),
      lluviaTotal: suma(dias.map((d) => d.lluvia)),
      lluviaDiariaMedia: media(dias.map((d) => d.lluvia)),
      gddPeriodo: suma(dias.map((d) => d.gdd)),
      diasConDatos: dias.length,
    };
  }

  private agruparMensual(dias: DiaClima[]): DiaClima[] {
    const porMes = new Map<string, DiaClima[]>();
    for (const d of dias) {
      const key = d.fecha.slice(0, 7); // YYYY-MM
      const arr = porMes.get(key) ?? [];
      arr.push(d);
      porMes.set(key, arr);
    }
    return Array.from(porMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, rows]) => ({
        fecha: mes,
        tMedia: media(rows.map((r) => r.tMedia)),
        tMax: media(rows.map((r) => r.tMax)),
        tMin: media(rows.map((r) => r.tMin)),
        hr: media(rows.map((r) => r.hr)),
        lluvia: suma(rows.map((r) => r.lluvia)),
        gdd: suma(rows.map((r) => r.gdd)),
      }));
  }

  /**
   * Serie multi-año del mismo mes (para "Mes"): últimos 10 años calendario
   * hasta el año elegido inclusive. Cada año es un request a POWER (cacheado).
   */
  private async serieAnual(
    lat: number,
    lng: number,
    anioRef: number,
    mes: number,
  ): Promise<FilaSerieAnual[]> {
    const ANIOS = 10;
    const desde = Math.max(1981, anioRef - ANIOS + 1);
    const filas: FilaSerieAnual[] = [];

    for (let anio = desde; anio <= anioRef; anio++) {
      const serie = await this.power.getDaily(
        lat,
        lng,
        new Date(anio, mes - 1, 1),
        new Date(anio, mes, 0),
      );
      const aggr = this.agregar(this.diasDesdeSerie(serie));
      filas.push({
        anio,
        tMedia: round1(aggr.tMedia ?? NaN) as number | null,
        tMax: round1(aggr.tMaxMedia ?? NaN) as number | null,
        tMin: round1(aggr.tMinMedia ?? NaN) as number | null,
        hr: round1(aggr.hrMedia ?? NaN) as number | null,
        lluvia: round2(aggr.lluviaTotal ?? NaN) as number | null,
        gddMes: round1(aggr.gddPeriodo ?? NaN) as number | null,
      });
    }
    return filas;
  }

  private centroide(lote: Lote): { lat: number; lng: number } | null {
    if (lote.centroide) return lote.centroide;
    if (!lote.geometria) return null;

    // Fallback: promedio de los vértices del anillo exterior del polígono.
    const coords = this.coordenadasPoligono(lote.geometria);
    if (coords.length === 0) return null;
    const lat = coords.reduce((a, c) => a + c[1], 0) / coords.length;
    const lng = coords.reduce((a, c) => a + c[0], 0) / coords.length;
    return { lat, lng };
  }

  private coordenadasPoligono(geometria: object): Array<[number, number]> {
    const g = geometria as {
      type?: string;
      coordinates?: unknown;
    };
    if (g?.type === "Point" && Array.isArray(g.coordinates)) {
      return [g.coordinates as [number, number]];
    }
    const rings =
      g?.type === "Polygon"
        ? (g.coordinates as unknown[][])
        : g?.type === "MultiPolygon"
          ? (g.coordinates as unknown[][][])[0]
          : null;
    if (!rings || rings.length === 0) return [];
    return (rings[0] as Array<[number, number]>).map((c) => [
      Number(c[0]),
      Number(c[1]),
    ]);
  }
}
