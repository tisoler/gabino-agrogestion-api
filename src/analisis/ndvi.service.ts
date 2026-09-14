import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Lote } from "../entities/lote.entity";
import {
  normalizarPeriodo,
  resolverVentana,
  type PeriodoClima,
} from "./periodos";
import {
  anilloExterior,
  centroideDe,
  validarAccesoLote,
  type Anillo,
} from "./lote-geo.util";
import { SentinelNdviService } from "./sentinel-ndvi.service";
import { GibsNdviService } from "./gibs-ndvi.service";
import type { FilaNdvi, NdviStats, RespuestaNdvi } from "./ndvi-tipos";

interface VentanaNdvi {
  start: Date;
  end: Date;
  etiqueta: string; // "YYYY-MM" o "YYYY-MM-DD"
}

/** Lado del cuadrado aproximado (~1 km) cuando el lote sólo tiene punto. */
const MEDIO_LADO_APROX = 0.005;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

@Injectable()
export class NdviService {
  constructor(
    @InjectRepository(Lote) private readonly loteRepo: Repository<Lote>,
    private readonly sentinel: SentinelNdviService,
    private readonly gibs: GibsNdviService,
  ) {}

  /**
   * Serie NDVI del lote: Sentinel-2 (CDSE Process API, 10–20 m, estadísticas
   * server-side) como fuente primaria y NASA GIBS VIIRS 8-day (~500 m) como
   * fallback cuando no hay credenciales o no hay escenas limpias de nubes.
   */
  async ndvi(
    idLote: number,
    user: any,
    periodoRaw?: string,
    fecha?: string,
  ): Promise<RespuestaNdvi> {
    const periodo = normalizarPeriodo(periodoRaw);

    const lote = await this.loteRepo.findOne({
      where: { id: idLote },
      relations: ["campo", "empresa"],
    });
    if (!lote) throw new NotFoundException("Lote no encontrado");

    validarAccesoLote(lote, user);

    let anillo = anilloExterior(lote.geometria);
    let aproximado = false;
    if (anillo.length < 4) {
      const centro = centroideDe(lote);
      if (!centro) {
        throw new BadRequestException(
          "El lote no tiene geometría ni centroide para calcular NDVI",
        );
      }
      anillo = this.cuadradoEn(centro.lat, centro.lng);
      aproximado = true;
    }

    const ventanaBase = resolverVentana(periodo, fecha);
    const ventanas = this.dividirVentana(
      periodo,
      ventanaBase.start,
      ventanaBase.end,
    );

    const serie: FilaNdvi[] = [];
    for (const v of ventanas) {
      let stats: NdviStats | null = null;
      try {
        stats = await this.sentinel.getStats(anillo, v.start, v.end);
        if (!stats) stats = await this.gibs.getStats(anillo, v.end);
      } catch {
        stats = null;
      }
      if (stats) serie.push({ ...stats, fecha: v.etiqueta });
    }

    const fuentes = new Set(serie.map((f) => f.fuente));
    const fuente =
      fuentes.size === 0
        ? null
        : fuentes.size === 1
          ? (Array.from(fuentes)[0] as "sentinel-2" | "viirs")
          : ("mixta" as const);

    const ultimo = serie.length > 0 ? serie[serie.length - 1] : null;
    const valores = serie
      .map((f) => f.ndviMedia)
      .filter((v): v is number => v != null);
    const heterogeneidad =
      ultimo && ultimo.p90 != null && ultimo.p10 != null
        ? round3(ultimo.p90 - ultimo.p10)
        : null;

    return {
      lote: {
        id: lote.id,
        descripcion: lote.descripcion || null,
        campoNombre: lote.campo?.nombre ?? null,
        empresaNombre: lote.empresa?.nombre ?? null,
        centroide: centroideDe(lote),
      },
      periodo,
      campania: ventanaBase.campania ?? null,
      fuente,
      ultimo,
      serie,
      agregados: {
        ndviMedio: valores.length
          ? round3(valores.reduce((a, b) => a + b, 0) / valores.length)
          : null,
        heterogeneidad,
        ventanasConDatos: serie.length,
      },
      aproximado,
    };
  }

  /**
   * Ventanas de la serie: "actual" y "mes" son una sola; "campania" se corta
   * por mes calendario (una request por mes, cacheadas; las pasadas con TTL
   * largo). Las ventanas terminan como máximo hoy.
   */
  private dividirVentana(
    periodo: PeriodoClima,
    start: Date,
    end: Date,
  ): VentanaNdvi[] {
    const hoy = new Date();
    const iso = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (periodo === "actual") {
      const desde = new Date();
      desde.setDate(desde.getDate() - 29); // 30 días: alcanzan para una escena S2
      return [{ start: desde, end: hoy, etiqueta: iso(hoy) }];
    }

    if (periodo === "mes") {
      return [
        {
          start,
          end,
          etiqueta: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
        },
      ];
    }

    const ventanas: VentanaNdvi[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const finMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const e = finMes > hoy ? hoy : finMes;
      ventanas.push({
        start: new Date(cursor),
        end: e,
        etiqueta: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return ventanas;
  }

  private cuadradoEn(lat: number, lng: number): Anillo {
    const x0 = lng - MEDIO_LADO_APROX;
    const x1 = lng + MEDIO_LADO_APROX;
    const y0 = lat - MEDIO_LADO_APROX;
    const y1 = lat + MEDIO_LADO_APROX;
    return [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ];
  }
}
