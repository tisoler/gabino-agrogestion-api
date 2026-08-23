import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Reporte, TipoCosecha, TipoReporte } from "../entities/reporte.entity";
import { ReporteFila } from "../entities/reporte-fila.entity";
import { Empresa } from "../entities/empresa.entity";
import { Lote } from "../entities/lote.entity";
import { Campania } from "../entities/campania.entity";
import { Roles } from "../constantes";
import { calcularResultados } from "../campanias/campanias.calculos";
import { CotizacionesService } from "../cotizaciones/cotizaciones.service";
import { CreateReporteDto, ReporteFilaDto } from "./dto/create-reporte.dto";

export interface ResumenFilaCalculada {
  id: number | null;
  idLote: number;
  loteNombre: string;
  campoNombre: string | null;
  idProduccionFina: number | null;
  cultivoFinaNombre: string | null;
  idProduccionGruesa: number | null;
  cultivoGruesaNombre: string | null;
  margenBrutoHa: number | null;
  superficie: number | null;
  margenBrutoLote: number | null;
}

export interface DetalleFilaCalculada {
  id: number | null;
  idLote: number;
  loteNombre: string;
  campoNombre: string | null;
  idProduccion: number | null;
  cultivoNombre: string;
  produccionQq: number | null;
  precioQq: number | null;
  porcentajeAsesoramiento: number;
  totalAsesoramiento: number | null;
}

export interface ReporteCalculado {
  id: number | null;
  idEmpresa: number;
  empresaNombre: string;
  campania: string;
  tipo: TipoReporte;
  tipoCosecha: TipoCosecha | null;
  asesoramientoPorcentaje: number | null;
  aplicaIva: boolean;
  filas: (ResumenFilaCalculada | DetalleFilaCalculada)[];
  totales:
    | {
        superficieTotal: number;
        margenBrutoTotal: number;
        margenBrutoMedioHa: number;
        eqSoja: number | null;
      }
    | {
        totalSinIva: number;
        iva: number;
        totalConIva: number;
        aplicaIva: boolean;
      };
}

export interface ProduccionCandidata {
  id: number;
  idLote: number;
  loteDescripcion: string;
  campoNombre: string | null;
  idCultivo: number;
  cultivoNombre: string;
  tipoCosecha: TipoCosecha | null;
  supSembrada: number;
  margenBrutoSAlquilerLote: number;
  produccionQq: number;
  precioXQq: number;
}

export interface ProduccionLote {
  id: number;
  descripcion: string | null;
  campoNombre: string | null;
}

export interface ProduccionesReporte {
  lotes: ProduccionLote[];
  producciones: ProduccionCandidata[];
}

const IVA_PCT = 0.21;

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v: number): number => Math.round(v * 100) / 100;

const esAdmin = (user: any): boolean =>
  user.roles?.includes(Roles.SYS_ADMIN) ||
  user.roles?.includes(Roles.ASESOR_ADMIN);

const empresasDelUsuario = (user: any): number[] =>
  (user.idEmpresas || []).map((e: any) => Number(e));

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Reporte) private reporteRepo: Repository<Reporte>,
    @InjectRepository(ReporteFila) private filaRepo: Repository<ReporteFila>,
    @InjectRepository(Empresa) private empresaRepo: Repository<Empresa>,
    @InjectRepository(Lote) private loteRepo: Repository<Lote>,
    @InjectRepository(Campania) private campaniaRepo: Repository<Campania>,
    private cotizaciones: CotizacionesService,
  ) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------
  async create(user: any, dto: CreateReporteDto): Promise<ReporteCalculado> {
    const { reporte } = await this.validarYNormalizar(dto, user);
    reporte.filas = dto.filas.map((f) => this.filaDesdeDto(f));
    const saved = await this.reporteRepo.save(reporte);
    return this.computar(saved.id, user);
  }

  async findAll(user: any): Promise<
    Array<{
      id: number;
      idEmpresa: number;
      empresaNombre: string;
      campania: string;
      tipo: TipoReporte;
      tipoCosecha: TipoCosecha | null;
      asesoramientoPorcentaje: number | null;
      aplicaIva: boolean;
      filaCount: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const isAdmin = esAdmin(user);
    const userEmpresas = empresasDelUsuario(user);

    const qb = this.reporteRepo
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.empresa", "empresa")
      .where("r.activo = :activo", { activo: true })
      .orderBy("r.updatedAt", "DESC");

    if (!isAdmin) {
      if (userEmpresas.length === 0) return [];
      qb.andWhere("r.id_empresa IN (:...ids)", { ids: userEmpresas });
    }

    const reportes = await qb.getMany();
    if (reportes.length === 0) return [];

    const filaCounts = await this.filaRepo
      .createQueryBuilder("f")
      .select("f.id_reporte", "id_reporte")
      .addSelect("COUNT(*)", "cnt")
      .where("f.id_reporte IN (:...ids)", { ids: reportes.map((r) => r.id) })
      .groupBy("f.id_reporte")
      .getRawMany<{ id_reporte: number; cnt: string }>();

    const countBy = new Map<number, number>();
    for (const row of filaCounts)
      countBy.set(Number(row.id_reporte), Number(row.cnt));

    return reportes.map((r) => ({
      id: r.id,
      idEmpresa: r.idEmpresa,
      empresaNombre: r.empresa?.nombre || `Productor #${r.idEmpresa}`,
      campania: r.campania,
      tipo: r.tipo,
      tipoCosecha: r.tipoCosecha,
      asesoramientoPorcentaje: num(r.asesoramientoPorcentaje) || null,
      aplicaIva: r.aplicaIva,
      filaCount: countBy.get(r.id) ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findOne(user: any, id: number): Promise<ReporteCalculado> {
    return this.computar(id, user);
  }

  async update(
    user: any,
    id: number,
    dto: CreateReporteDto,
  ): Promise<ReporteCalculado> {
    const reporte = await this.reporteOrThrow(id, user);
    const { reporte: normalizado } = await this.validarYNormalizar(dto, user);

    reporte.idEmpresa = normalizado.idEmpresa;
    reporte.campania = normalizado.campania;
    reporte.tipo = normalizado.tipo;
    reporte.tipoCosecha = normalizado.tipoCosecha;
    reporte.asesoramientoPorcentaje = normalizado.asesoramientoPorcentaje;
    reporte.aplicaIva = normalizado.aplicaIva;

    await this.filaRepo.delete({ idReporte: id });
    reporte.filas = dto.filas.map((f) => this.filaDesdeDto(f));
    await this.reporteRepo.save(reporte);

    return this.computar(id, user);
  }

  async remove(user: any, id: number): Promise<{ ok: boolean }> {
    const reporte = await this.reporteOrThrow(id, user);
    reporte.activo = false;
    await this.reporteRepo.save(reporte);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Producciones candidatas para los builders
  // ---------------------------------------------------------------------------
  async producciones(
    user: any,
    empresaId: number,
    campania: string,
  ): Promise<ProduccionesReporte> {
    const isAdmin = esAdmin(user);
    const userEmpresas = empresasDelUsuario(user);
    if (!isAdmin && !userEmpresas.includes(empresaId)) {
      throw new ForbiddenException(
        "No tiene permisos para consultar este productor",
      );
    }

    const campanias = await this.campaniaRepo.find({
      where: { campania, activo: true },
      relations: {
        lote: { campo: true },
        cultivo: true,
        labores: true,
        insumos: true,
        costos: true,
      },
    });

    const delProductor = campanias.filter(
      (c) => c.lote?.idEmpresa === empresaId,
    );

    const dolarInsumo = await this.obtenerDolarVenta();

    const lotes = new Map<number, ProduccionLote>();
    const producciones: ProduccionCandidata[] = [];

    for (const c of delProductor) {
      lotes.set(c.idLote, {
        id: c.idLote,
        descripcion: c.lote?.descripcion ?? null,
        campoNombre: c.lote?.campo?.nombre ?? null,
      });
      const m = this.margenDe(c, dolarInsumo);
      producciones.push({
        id: c.id,
        idLote: c.idLote,
        loteDescripcion: c.lote?.descripcion || `Lote #${c.idLote}`,
        campoNombre: c.lote?.campo?.nombre ?? null,
        idCultivo: c.idCultivo,
        cultivoNombre: c.cultivo?.nombre || `Cultivo #${c.idCultivo}`,
        tipoCosecha: (c.cultivo?.tipoCosecha as TipoCosecha | null) ?? null,
        supSembrada: m.supSembrada,
        margenBrutoSAlquilerLote: m.margenBrutoSAlquilerLote,
        produccionQq: num(c.prodNetaTotalQq),
        precioXQq: num(c.precioXQq),
      });
    }

    producciones.sort((a, b) =>
      a.loteDescripcion.localeCompare(b.loteDescripcion, "es"),
    );
    const lotesArray = Array.from(lotes.entries())
      .map(([, lote]) => lote)
      .sort((a, b) =>
        (a.descripcion || "").localeCompare(b.descripcion || "", "es"),
      );

    return { lotes: lotesArray, producciones };
  }

  // ---------------------------------------------------------------------------
  // Cálculo
  // ---------------------------------------------------------------------------
  private async computar(id: number, user: any): Promise<ReporteCalculado> {
    const reporte = await this.reporteOrThrow(id, user);
    const empresa = await this.empresaRepo.findOne({
      where: { id: reporte.idEmpresa },
    });
    const filas = await this.filaRepo.find({
      where: { idReporte: id },
      relations: {
        lote: { campo: true },
        produccion: {
          cultivo: true,
          lote: { campo: true },
          labores: true,
          insumos: true,
          costos: true,
        },
        produccionFina: {
          cultivo: true,
          lote: { campo: true },
          labores: true,
          insumos: true,
          costos: true,
        },
        produccionGruesa: {
          cultivo: true,
          lote: { campo: true },
          labores: true,
          insumos: true,
          costos: true,
        },
      },
      order: { id: "ASC" },
    });
    return this.calcularDesde(
      reporte,
      empresa?.nombre || `Productor #${reporte.idEmpresa}`,
      filas,
    );
  }

  private async calcularDesde(
    reporte: Reporte,
    empresaNombre: string,
    filas: ReporteFila[],
  ): Promise<ReporteCalculado> {
    if (reporte.tipo === "resumen_campania") {
      const dolarInsumo = await this.obtenerDolarVenta();
      const computadas: ResumenFilaCalculada[] = [];
      let superficieTotal = 0;
      let margenTotal = 0;
      let precioSoja: number | null = null;

      for (const f of filas) {
        const mFina = this.margenDe(f.produccionFina, dolarInsumo);
        const mGruesa = this.margenDe(f.produccionGruesa, dolarInsumo);

        const superficie = mFina?.supSembrada ?? mGruesa?.supSembrada ?? 0;
        const margenLote =
          (mFina?.margenBrutoSAlquilerLote ?? 0) +
          (mGruesa?.margenBrutoSAlquilerLote ?? 0);

        superficieTotal += superficie;
        margenTotal += margenLote;
        if (precioSoja === null && mGruesa?.precioXQq != null)
          precioSoja = mGruesa.precioXQq;

        computadas.push({
          id: f.id,
          idLote: f.idLote,
          loteNombre:
            f.lote?.descripcion ||
            f.produccionFina?.lote?.descripcion ||
            f.produccionGruesa?.lote?.descripcion ||
            `Lote #${f.idLote}`,
          campoNombre:
            f.lote?.campo?.nombre ??
            f.produccionFina?.lote?.campo?.nombre ??
            f.produccionGruesa?.lote?.campo?.nombre ??
            null,
          idProduccionFina: f.idProduccionFina,
          cultivoFinaNombre: f.produccionFina?.cultivo?.nombre ?? null,
          idProduccionGruesa: f.idProduccionGruesa,
          cultivoGruesaNombre: f.produccionGruesa?.cultivo?.nombre ?? null,
          margenBrutoHa: superficie > 0 ? margenLote / superficie : null,
          superficie: superficie || null,
          margenBrutoLote: margenLote || null,
        });
      }

      const margenBrutoMedioHa =
        superficieTotal > 0 ? margenTotal / superficieTotal : 0;

      return {
        id: reporte.id,
        idEmpresa: reporte.idEmpresa,
        empresaNombre,
        campania: reporte.campania,
        tipo: reporte.tipo,
        tipoCosecha: null,
        asesoramientoPorcentaje: null,
        aplicaIva: false,
        filas: computadas,
        totales: {
          superficieTotal: round2(superficieTotal),
          margenBrutoTotal: round2(margenTotal),
          margenBrutoMedioHa: round2(margenBrutoMedioHa),
          eqSoja:
            precioSoja && precioSoja > 0
              ? round2(margenBrutoMedioHa / precioSoja)
              : null,
        },
      };
    }

    // detalle_asesoramiento
    const computadas: DetalleFilaCalculada[] = [];
    let totalSinIva = 0;

    for (const f of filas) {
      const pct =
        f.porcentajeAsesoramiento != null
          ? num(f.porcentajeAsesoramiento)
          : num(reporte.asesoramientoPorcentaje);
      const produccionQq = f.produccion
        ? num(f.produccion.prodNetaTotalQq)
        : null;
      const precioQq = f.produccion ? num(f.produccion.precioXQq) : null;
      const total =
        produccionQq != null && precioQq != null
          ? produccionQq * precioQq * pct
          : null;
      if (total != null) totalSinIva += total;

      computadas.push({
        id: f.id,
        idLote: f.idLote,
        loteNombre:
          f.lote?.descripcion ||
          f.produccion?.lote?.descripcion ||
          `Lote #${f.idLote}`,
        campoNombre:
          f.lote?.campo?.nombre ?? f.produccion?.lote?.campo?.nombre ?? null,
        idProduccion: f.idProduccion,
        cultivoNombre:
          f.produccion?.cultivo?.nombre ||
          `Cultivo #${f.produccion?.idCultivo}`,
        produccionQq,
        precioQq,
        porcentajeAsesoramiento: pct,
        totalAsesoramiento: total != null ? round2(total) : null,
      });
    }

    const aplicaIva = !!reporte.aplicaIva;
    const iva = aplicaIva ? totalSinIva * IVA_PCT : 0;

    return {
      id: reporte.id,
      idEmpresa: reporte.idEmpresa,
      empresaNombre,
      campania: reporte.campania,
      tipo: reporte.tipo,
      tipoCosecha: reporte.tipoCosecha,
      asesoramientoPorcentaje: num(reporte.asesoramientoPorcentaje) || null,
      aplicaIva,
      filas: computadas,
      totales: {
        totalSinIva: round2(totalSinIva),
        iva: round2(iva),
        totalConIva: round2(totalSinIva + iva),
        aplicaIva,
      },
    };
  }

  private margenDe(
    c: Campania | null,
    dolarInsumo = 1,
  ): {
    margenBrutoSAlquilerLote: number;
    supSembrada: number;
    precioXQq: number;
  } | null {
    if (!c) return null;
    const r = calcularResultados(
      {
        supSembrada: num(c.supSembrada),
        supCosechada: num(c.supCosechada),
        prodNetaTotalQq: num(c.prodNetaTotalQq),
        precioXQq: num(c.precioXQq),
        comercializacionPct: num(c.comercializacionPct),
        cosechaXHa: num(c.cosechaXHa),
        alquilerQqHa: num(c.alquilerQqHa),
        labores: c.labores || [],
        insumos: c.insumos || [],
        costos: c.costos || [],
      },
      dolarInsumo,
    );
    return {
      margenBrutoSAlquilerLote: r.margenBrutoSAlquilerLote,
      supSembrada: num(c.supSembrada),
      precioXQq: num(c.precioXQq),
    };
  }

  /** Dólar venta para convertir los costos de insumos (USD) a pesos. */
  private async obtenerDolarVenta(): Promise<number> {
    try {
      const { venta } = await this.cotizaciones.getDolarBNA();
      return Number.isFinite(venta) && venta > 0 ? venta : 1;
    } catch {
      return 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Validación
  // ---------------------------------------------------------------------------
  private async validarYNormalizar(
    dto: CreateReporteDto,
    user: any,
  ): Promise<{ reporte: Reporte }> {
    const isAdmin = esAdmin(user);
    const userEmpresas = empresasDelUsuario(user);

    if (!isAdmin && !userEmpresas.includes(dto.idEmpresa)) {
      throw new ForbiddenException(
        "No tiene permisos para generar reportes para este productor",
      );
    }
    const empresa = await this.empresaRepo.findOne({
      where: { id: dto.idEmpresa, activo: true },
    });
    if (!empresa)
      throw new BadRequestException("El productor indicado no existe");

    if (dto.filas.length === 0) {
      throw new BadRequestException("Debe agregar al menos un lote al reporte");
    }

    if (dto.tipo === "detalle_asesoramiento" && !dto.tipoCosecha) {
      throw new BadRequestException("Debe indicar el tipo de cosecha");
    }

    for (const f of dto.filas) {
      const lote = await this.loteRepo.findOne({ where: { id: f.idLote } });
      if (!lote) throw new BadRequestException(`El lote ${f.idLote} no existe`);
      if (lote.idEmpresa !== dto.idEmpresa) {
        throw new BadRequestException(
          `El lote ${lote.descripcion || lote.id} no pertenece al productor seleccionado`,
        );
      }

      if (dto.tipo === "resumen_campania") {
        if (f.idProduccionFina != null) {
          await this.validarProduccion(
            f.idProduccionFina,
            "fina",
            dto,
            f.idLote,
          );
        }
        if (f.idProduccionGruesa != null) {
          await this.validarProduccion(
            f.idProduccionGruesa,
            "gruesa",
            dto,
            f.idLote,
          );
        }
        if (f.idProduccionFina == null && f.idProduccionGruesa == null) {
          throw new BadRequestException(
            "Cada lote debe tener al menos una producción (fina o gruesa)",
          );
        }
      } else {
        if (f.idProduccion == null)
          throw new BadRequestException("Cada lote debe tener una producción");
        await this.validarProduccion(
          f.idProduccion,
          dto.tipoCosecha!,
          dto,
          f.idLote,
        );
      }
    }

    return {
      reporte: this.reporteRepo.create({
        idEmpresa: dto.idEmpresa,
        campania: dto.campania,
        tipo: dto.tipo,
        tipoCosecha: dto.tipoCosecha ?? null,
        asesoramientoPorcentaje: dto.asesoramientoPorcentaje ?? null,
        aplicaIva: dto.aplicaIva ?? false,
        activo: true,
      }),
    };
  }

  private async validarProduccion(
    idProduccion: number,
    tipoCosecha: TipoCosecha,
    dto: CreateReporteDto,
    idLote: number,
  ) {
    const campania = await this.campaniaRepo.findOne({
      where: { id: idProduccion },
      relations: ["lote", "cultivo"],
    });
    if (!campania)
      throw new BadRequestException(`La producción ${idProduccion} no existe`);
    if (!campania.activo)
      throw new BadRequestException(
        `La producción ${idProduccion} no está activa`,
      );
    if (campania.campania !== dto.campania) {
      throw new BadRequestException(
        "La producción no corresponde a la campaña seleccionada",
      );
    }
    if (campania.idLote !== idLote) {
      throw new BadRequestException(
        "La producción no corresponde al lote seleccionado",
      );
    }
    if (campania.lote?.idEmpresa !== dto.idEmpresa) {
      throw new BadRequestException(
        "La producción no pertenece al productor seleccionado",
      );
    }
    if (campania.cultivo?.tipoCosecha !== tipoCosecha) {
      throw new BadRequestException(
        `La producción no corresponde a un cultivo de tipo ${tipoCosecha === "fina" ? "fina" : "gruesa"}`,
      );
    }
  }

  private filaDesdeDto(f: ReporteFilaDto): ReporteFila {
    return this.filaRepo.create({
      idLote: f.idLote,
      idProduccion: f.idProduccion ?? null,
      idProduccionFina: f.idProduccionFina ?? null,
      idProduccionGruesa: f.idProduccionGruesa ?? null,
      porcentajeAsesoramiento: f.porcentajeAsesoramiento ?? null,
    });
  }

  private async reporteOrThrow(id: number, user: any): Promise<Reporte> {
    const reporte = await this.reporteRepo.findOne({
      where: { id, activo: true },
    });
    if (!reporte) throw new NotFoundException("Reporte no encontrado");

    if (
      !esAdmin(user) &&
      !empresasDelUsuario(user).includes(reporte.idEmpresa)
    ) {
      throw new ForbiddenException(
        "No tiene permisos para acceder a este reporte",
      );
    }
    return reporte;
  }
}
