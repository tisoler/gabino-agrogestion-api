import { Injectable, NotFoundException } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import { Campania } from "../entities/campania.entity";
import { CampaniaLabor } from "../entities/campania-labor.entity";
import { CampaniaInsumo } from "../entities/campania-insumo.entity";
import { CampaniaCosto } from "../entities/campania-costo.entity";
import { Lote } from "../entities/lote.entity";
import { Labor } from "../entities/labor.entity";
import { Insumo } from "../entities/insumo.entity";
import { Costo } from "../entities/costo.entity";
import { Cultivo } from "../entities/cultivo.entity";
import { Variedad } from "../entities/variedad.entity";
import { CreateCampaniaDto } from "./dto/create-campania.dto";
import { UpdateCampaniaDto } from "./dto/update-campania.dto";
import {
  CreateCampaniaDetalleCostoDto,
  CreateCampaniaDetalleInsumoDto,
  CreateCampaniaDetalleLaborDto,
} from "./dto/create-detalle.dto";
import {
  UpdateCampaniaDetalleCostoDto,
  UpdateCampaniaDetalleInsumoDto,
  UpdateCampaniaDetalleLaborDto,
} from "./dto/update-detalle.dto";
import { Roles } from "../constantes";
import {
  calcularResultados,
  type ResultadosCampania,
} from "./campanias.calculos";
import { NotificacionesService } from "../notificaciones/notificaciones.service";

export interface CampaniaTotales extends ResultadosCampania {
  supSembrada: number;
  supCosechada: number;
}

export interface CampaniaListItem {
  id: number;
  campania: string;
  idLote: number;
  idCultivo: number;
  idVariedad: number | null;
  lote?: Lote | null;
  cultivo?: Cultivo | null;
  variedad?: Variedad | null;
  totales: CampaniaTotales;
}

export interface FindCampaniasFilters {
  currentEmpresaId?: number;
  empresaIds?: number[];
  campanias?: string[];
  idCampo?: number[];
  idLote?: number[];
  idCultivo?: number[];
  idVariedad?: number[];
}

@Injectable()
export class CampaniasService {
  constructor(
    @InjectRepository(Campania) private campaniaRepo: Repository<Campania>,
    @InjectRepository(CampaniaLabor)
    private campaniaLaborRepo: Repository<CampaniaLabor>,
    @InjectRepository(CampaniaInsumo)
    private campaniaInsumoRepo: Repository<CampaniaInsumo>,
    @InjectRepository(CampaniaCosto)
    private campaniaCostoRepo: Repository<CampaniaCosto>,
    @InjectRepository(Lote) private loteRepo: Repository<Lote>,
    @InjectRepository(Labor) private laborRepo: Repository<Labor>,
    @InjectRepository(Insumo) private insumoRepo: Repository<Insumo>,
    @InjectRepository(Costo) private costoRepo: Repository<Costo>,
    @InjectRepository(Cultivo) private cultivoRepo: Repository<Cultivo>,
    @InjectRepository(Variedad) private variedadRepo: Repository<Variedad>,
    private notificaciones: NotificacionesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Listado (dashboard)
  // ---------------------------------------------------------------------------
  /**
   * Lista campañas según el scope del usuario.
   *
   *  - sys-admin: ve todas. Si llega `currentEmpresaId` filtra a esa empresa.
   *  - asesor / productor: ve solo campañas de lotes cuyas empresas estén
   *    en su `idEmpresas`. Si llega `currentEmpresaId` y está en su scope,
   *    filtra a esa.
   *
   * Devuelve cabeceras con `lote`, `cultivo` y `variedad` eager para que la
   * grilla pueda mostrar nombre sin un segundo fetch. Los detalles (labores /
   * insumos / costos) NO se incluyen en el listado.
   */
  async findAll(user: any, filters: FindCampaniasFilters = {}) {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    const qb = this.campaniaRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.lote", "lote")
      .leftJoinAndSelect("lote.campo", "campo")
      .leftJoinAndSelect("c.cultivo", "cultivo")
      .leftJoinAndSelect("c.variedad", "variedad");

    if (filters.empresaIds && filters.empresaIds.length > 0) {
      // Filtro multiselect de productores. Para no-admins se respeta su scope.
      const ids = isAdmin
        ? filters.empresaIds
        : filters.empresaIds.filter((id) => userEmpresas.includes(id));
      if (ids.length === 0) return [];
      qb.andWhere("lote.id_empresa IN (:...ids)", { ids });
    } else if (filters.currentEmpresaId) {
      const id = Number(filters.currentEmpresaId);
      if (!isAdmin && !userEmpresas.includes(id)) return [];
      qb.andWhere("lote.id_empresa = :empresaId", { empresaId: id });
    } else if (!isAdmin) {
      if (userEmpresas.length === 0) return [];
      qb.andWhere("lote.id_empresa IN (:...ids)", { ids: userEmpresas });
    }

    if (filters.campanias && filters.campanias.length > 0) {
      qb.andWhere("c.campania IN (:...campanias)", {
        campanias: filters.campanias,
      });
    }
    if (filters.idCampo && filters.idCampo.length > 0) {
      const sinCampo = filters.idCampo.includes(0);
      const campos = filters.idCampo.filter((n) => n !== 0);
      if (campos.length === 0) {
        qb.andWhere("lote.id_campo IS NULL");
      } else if (sinCampo) {
        qb.andWhere(
          "(lote.id_campo IN (:...campos) OR lote.id_campo IS NULL)",
          { campos },
        );
      } else {
        qb.andWhere("lote.id_campo IN (:...campos)", { campos });
      }
    }
    if (filters.idLote && filters.idLote.length > 0) {
      qb.andWhere("c.id_lote IN (:...idLote)", { idLote: filters.idLote });
    }
    if (filters.idCultivo && filters.idCultivo.length > 0) {
      qb.andWhere("c.id_cultivo IN (:...idCultivo)", {
        idCultivo: filters.idCultivo,
      });
    }
    if (filters.idVariedad && filters.idVariedad.length > 0) {
      qb.andWhere("c.id_variedad IN (:...idVariedad)", {
        idVariedad: filters.idVariedad,
      });
    }

    qb.orderBy("c.campania", "DESC").addOrderBy("c.id", "DESC");
    const cabeceras = await qb.getMany();
    if (cabeceras.length === 0) return [];

    // Cargamos los detalles (labores / insumos / costos) en bloque para
    // calcular los totales del dashboard en una sola pasada.
    const ids = cabeceras.map((c) => c.id);
    const [labores, insumos, costos] = await Promise.all([
      this.campaniaLaborRepo.find({ where: { idCampania: In(ids) } }),
      this.campaniaInsumoRepo.find({ where: { idCampania: In(ids) } }),
      this.campaniaCostoRepo.find({ where: { idCampania: In(ids) } }),
    ]);

    const lMap = new Map<number, CampaniaLabor[]>();
    const iMap = new Map<number, CampaniaInsumo[]>();
    const cMap = new Map<number, CampaniaCosto[]>();
    for (const l of labores) {
      const arr = lMap.get(l.idCampania) ?? [];
      arr.push(l);
      lMap.set(l.idCampania, arr);
    }
    for (const i of insumos) {
      const arr = iMap.get(i.idCampania) ?? [];
      arr.push(i);
      iMap.set(i.idCampania, arr);
    }
    for (const c of costos) {
      const arr = cMap.get(c.idCampania) ?? [];
      arr.push(c);
      cMap.set(c.idCampania, arr);
    }

    return cabeceras.map<CampaniaListItem>((c) => {
      const supSembrada = c.supSembrada != null ? Number(c.supSembrada) : 0;
      const supCosechada = c.supCosechada != null ? Number(c.supCosechada) : 0;
      const r = calcularResultados({
        supSembrada,
        supCosechada,
        prodNetaTotalQq:
          c.prodNetaTotalQq != null ? Number(c.prodNetaTotalQq) : 0,
        precioXQq: c.precioXQq != null ? Number(c.precioXQq) : 0,
        comercializacionPct:
          c.comercializacionPct != null ? Number(c.comercializacionPct) : 0,
        cosechaXHa: c.cosechaXHa != null ? Number(c.cosechaXHa) : 0,
        alquilerQqHa: c.alquilerQqHa != null ? Number(c.alquilerQqHa) : 0,
        labores: lMap.get(c.id) ?? [],
        insumos: iMap.get(c.id) ?? [],
        costos: cMap.get(c.id) ?? [],
      });
      return {
        id: c.id,
        campania: c.campania,
        idLote: c.idLote,
        idCultivo: c.idCultivo,
        idVariedad: c.idVariedad,
        lote: c.lote,
        cultivo: c.cultivo,
        variedad: c.variedad,
        totales: { ...r, supSembrada, supCosechada },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Detalle
  // ---------------------------------------------------------------------------
  async findOne(id: number, user: any) {
    const campania = await this.campaniaRepo.findOne({
      where: { id },
      relations: { lote: { campo: true }, cultivo: true, variedad: true },
    });
    if (!campania) throw new NotFoundException("Campaña no encontrada");

    await this.assertCampaniaAcceso(campania, user, "ver");

    // Labores e insumos: primero los originados por una prescripción (id asc)
    // y al final los que no tienen. En Postgres el ASC ordena NULL last por
    // defecto, así que idPrescripcion ASC ya cumple ese criterio.
    const [labores, insumos, costos] = await Promise.all([
      this.campaniaLaborRepo.find({
        where: { idCampania: id },
        relations: ["labor"],
        order: { idPrescripcion: "ASC", fecha: "ASC", id: "ASC" },
      }),
      this.campaniaInsumoRepo.find({
        where: { idCampania: id },
        relations: ["insumo"],
        order: { idPrescripcion: "ASC", id: "ASC" },
      }),
      this.campaniaCostoRepo.find({
        where: { idCampania: id },
        relations: ["costo"],
        order: { id: "ASC" },
      }),
    ]);

    return { ...campania, labores, insumos, costos };
  }

  // ---------------------------------------------------------------------------
  // Crear / actualizar / eliminar cabecera
  // ---------------------------------------------------------------------------
  async create(dto: CreateCampaniaDto, user: any, currentEmpresaId?: number) {
    const lote = await this.loteRepo.findOne({ where: { id: dto.idLote } });
    if (!lote) throw new BadRequestException("El lote indicado no existe");
    // Si el FE envió el productor destino (selector de la vista), se valida
    // contra ese; si no, contra la empresa actual del header.
    await this.assertLoteAcceso(
      lote,
      user,
      "crear campañas en",
      dto.idEmpresa ?? currentEmpresaId,
    );

    await this.assertCultivo(dto.idCultivo, user);
    if (dto.idVariedad)
      await this.assertVariedad(dto.idVariedad, dto.idCultivo, user);

    await this.assertProduccionUnica(dto.idLote, dto.campania, dto.idCultivo);

    const campania = this.campaniaRepo.create({
      campania: dto.campania,
      idLote: dto.idLote,
      idCultivo: dto.idCultivo,
      idVariedad: dto.idVariedad ?? null,
      supSembrada: dto.supSembrada ?? null,
      supCosechada: dto.supCosechada ?? null,
      prodNetaTotalQq: dto.prodNetaTotalQq ?? null,
      precioXQq: dto.precioXQq ?? null,
      alquilerQqHa: dto.alquilerQqHa ?? null,
      comercializacionPct: dto.comercializacionPct ?? null,
      cosechaXHa: dto.cosechaXHa ?? null,
      activo: true,
    });
    try {
      const saved = await this.campaniaRepo.save(campania);
      await this.notificarNuevaProduccion(saved, lote, user);
      return saved;
    } catch (e) {
      this.throwProduccionDuplicada(e);
    }
  }

  async update(id: number, dto: UpdateCampaniaDto, user: any) {
    const campania = await this.campaniaRepo.findOne({ where: { id } });
    if (!campania) throw new NotFoundException("Campaña no encontrada");
    await this.assertCampaniaAcceso(campania, user, "editar");

    if (dto.idLote && dto.idLote !== campania.idLote) {
      const lote = await this.loteRepo.findOne({ where: { id: dto.idLote } });
      if (!lote) throw new BadRequestException("El lote indicado no existe");
      await this.assertLoteAcceso(lote, user, "mover la campaña a");
    }

    if (dto.idCultivo && dto.idCultivo !== campania.idCultivo) {
      await this.assertCultivo(dto.idCultivo, user);
    }

    const variedadId =
      dto.idVariedad !== undefined ? dto.idVariedad : campania.idVariedad;
    const cultivoId = dto.idCultivo ?? campania.idCultivo;
    if (variedadId) await this.assertVariedad(variedadId, cultivoId, user);

    await this.assertProduccionUnica(
      dto.idLote ?? campania.idLote,
      dto.campania ?? campania.campania,
      cultivoId,
      id,
    );

    Object.assign(campania, dto);
    try {
      return await this.campaniaRepo.save(campania);
    } catch (e) {
      this.throwProduccionDuplicada(e);
    }
  }

  async remove(id: number, user: any) {
    const campania = await this.campaniaRepo.findOne({ where: { id } });
    if (!campania) throw new NotFoundException("Campaña no encontrada");
    await this.assertCampaniaAcceso(campania, user, "eliminar");

    campania.activo = false;
    return this.campaniaRepo.save(campania);
  }

  // ---------------------------------------------------------------------------
  // Detalles: LABORES
  // ---------------------------------------------------------------------------
  async addLabor(
    campaniaId: number,
    dto: CreateCampaniaDetalleLaborDto,
    user: any,
  ) {
    const campania = await this.campaniaOrThrow(campaniaId, user);
    await this.assertLaborEnScope(dto.idLabor, campania.lote.idEmpresa, user);

    const labor = this.campaniaLaborRepo.create({
      idCampania: campaniaId,
      idLabor: dto.idLabor,
      fecha: dto.fecha,
      superficieLaboreada: dto.superficieLaboreada,
      costoLaborHa: dto.costoLaborHa,
      observaciones: dto.observaciones ?? null,
    });
    return this.campaniaLaborRepo.save(labor);
  }

  async updateLabor(
    campaniaId: number,
    detalleId: number,
    dto: UpdateCampaniaDetalleLaborDto,
    user: any,
  ) {
    const campania = await this.campaniaOrThrow(campaniaId, user);
    const detalle = await this.campaniaLaborRepo.findOne({
      where: { id: detalleId, idCampania: campaniaId },
    });
    if (!detalle) throw new NotFoundException("Detalle de labor no encontrado");

    if (dto.idLabor && dto.idLabor !== detalle.idLabor) {
      await this.assertLaborEnScope(dto.idLabor, campania.lote.idEmpresa, user);
    }
    Object.assign(detalle, dto);
    return this.campaniaLaborRepo.save(detalle);
  }

  async removeLabor(campaniaId: number, detalleId: number, user: any) {
    await this.campaniaOrThrow(campaniaId, user);
    const detalle = await this.campaniaLaborRepo.findOne({
      where: { id: detalleId, idCampania: campaniaId },
    });
    if (!detalle) throw new NotFoundException("Detalle de labor no encontrado");
    await this.campaniaLaborRepo.delete(detalle.id);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Detalles: INSUMOS
  // ---------------------------------------------------------------------------
  async addInsumo(
    campaniaId: number,
    dto: CreateCampaniaDetalleInsumoDto,
    user: any,
  ) {
    const campania = await this.campaniaOrThrow(campaniaId, user);
    await this.assertInsumoEnScope(dto.idInsumo, campania.lote.idEmpresa, user);

    const insumo = this.campaniaInsumoRepo.create({
      idCampania: campaniaId,
      idInsumo: dto.idInsumo,
      unidadesHa: dto.unidadesHa,
      costoUnidad: dto.costoUnidad,
      superficieAplicada: dto.superficieAplicada ?? 0,
    });
    return this.campaniaInsumoRepo.save(insumo);
  }

  async updateInsumo(
    campaniaId: number,
    detalleId: number,
    dto: UpdateCampaniaDetalleInsumoDto,
    user: any,
  ) {
    const campania = await this.campaniaOrThrow(campaniaId, user);
    const detalle = await this.campaniaInsumoRepo.findOne({
      where: { id: detalleId, idCampania: campaniaId },
    });
    if (!detalle)
      throw new NotFoundException("Detalle de insumo no encontrado");

    if (dto.idInsumo && dto.idInsumo !== detalle.idInsumo) {
      await this.assertInsumoEnScope(
        dto.idInsumo,
        campania.lote.idEmpresa,
        user,
      );
    }
    Object.assign(detalle, dto);
    return this.campaniaInsumoRepo.save(detalle);
  }

  async removeInsumo(campaniaId: number, detalleId: number, user: any) {
    await this.campaniaOrThrow(campaniaId, user);
    const detalle = await this.campaniaInsumoRepo.findOne({
      where: { id: detalleId, idCampania: campaniaId },
    });
    if (!detalle)
      throw new NotFoundException("Detalle de insumo no encontrado");
    await this.campaniaInsumoRepo.delete(detalle.id);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Detalles: COSTOS VARIOS
  // ---------------------------------------------------------------------------
  async addCosto(
    campaniaId: number,
    dto: CreateCampaniaDetalleCostoDto,
    user: any,
  ) {
    const campania = await this.campaniaOrThrow(campaniaId, user);
    await this.assertCostoEnScope(dto.idCosto, campania.lote.idEmpresa, user);

    const costo = this.campaniaCostoRepo.create({
      idCampania: campaniaId,
      idCosto: dto.idCosto,
      unidadesHa: dto.unidadesHa,
      costoUnidad: dto.costoUnidad,
      observaciones: dto.observaciones ?? null,
    });
    return this.campaniaCostoRepo.save(costo);
  }

  async updateCosto(
    campaniaId: number,
    detalleId: number,
    dto: UpdateCampaniaDetalleCostoDto,
    user: any,
  ) {
    const campania = await this.campaniaOrThrow(campaniaId, user);
    const detalle = await this.campaniaCostoRepo.findOne({
      where: { id: detalleId, idCampania: campaniaId },
    });
    if (!detalle) throw new NotFoundException("Detalle de costo no encontrado");

    if (dto.idCosto && dto.idCosto !== detalle.idCosto) {
      await this.assertCostoEnScope(dto.idCosto, campania.lote.idEmpresa, user);
    }
    Object.assign(detalle, dto);
    return this.campaniaCostoRepo.save(detalle);
  }

  async removeCosto(campaniaId: number, detalleId: number, user: any) {
    await this.campaniaOrThrow(campaniaId, user);
    const detalle = await this.campaniaCostoRepo.findOne({
      where: { id: detalleId, idCampania: campaniaId },
    });
    if (!detalle) throw new NotFoundException("Detalle de costo no encontrado");
    await this.campaniaCostoRepo.delete(detalle.id);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Notificaciones
  // ---------------------------------------------------------------------------
  /**
   * Cuando un asesor o asesor-admin crea una producción para un lote cuyo
   * dueño (id_usuario) es otro usuario, le llega una notificación con el link
   * a la producción (campaña).
   */
  private async notificarNuevaProduccion(
    campania: Campania,
    lote: Lote,
    user: any,
  ) {
    const esAsesor = user.roles?.includes(Roles.ASESOR);
    const esAsesorAdmin = user.roles?.includes(Roles.ASESOR_ADMIN);
    if (!esAsesor && !esAsesorAdmin) return;

    if (!lote.idUsuario || lote.idUsuario === user.id) return;

    const loteNombre = lote.descripcion?.trim() || `Lote #${lote.id}`;
    await this.notificaciones.crear({
      idUsuario: lote.idUsuario,
      tipo: "produccion",
      mensaje: `Nueva producción en ${loteNombre} (${campania.campania})`,
      idCampania: campania.id,
      idPrescripcion: null,
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers de scope
  // ---------------------------------------------------------------------------
  private async assertProduccionUnica(
    idLote: number,
    campania: string,
    idCultivo: number,
    excludeId?: number,
  ) {
    const qb = this.campaniaRepo
      .createQueryBuilder("c")
      .where("c.id_lote = :idLote", { idLote })
      .andWhere("c.campania = :campania", { campania })
      .andWhere("c.id_cultivo = :idCultivo", { idCultivo })
      .andWhere("c.activo = true");
    if (excludeId !== undefined)
      qb.andWhere("c.id <> :excludeId", { excludeId });

    const existe = await qb.getOne();
    if (existe) {
      throw new BadRequestException(
        "Ya existe una producción con ese lote, campaña y cultivo",
      );
    }
  }

  private throwProduccionDuplicada(e: unknown): never {
    if (e instanceof QueryFailedError && (e as any).code === "23505") {
      throw new BadRequestException(
        "Ya existe una producción con ese lote, campaña y cultivo",
      );
    }
    throw e;
  }

  private async campaniaOrThrow(campaniaId: number, user: any) {
    const campania = await this.campaniaRepo.findOne({
      where: { id: campaniaId },
      relations: ["lote"],
    });
    if (!campania) throw new NotFoundException("Campaña no encontrada");
    await this.assertCampaniaAcceso(campania, user, "modificar");
    return campania;
  }

  private async assertCampaniaAcceso(
    campania: Campania,
    user: any,
    accion: string,
  ) {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    if (isAdmin) return;

    const lote =
      campania.lote ??
      (await this.loteRepo.findOne({ where: { id: campania.idLote } }));
    if (!lote) throw new NotFoundException("Lote de la campaña no encontrado");
    if (!userEmpresas.includes(lote.idEmpresa)) {
      throw new ForbiddenException(
        `No tiene permisos para ${accion} esta campaña`,
      );
    }
  }

  private async assertLoteAcceso(
    lote: Lote,
    user: any,
    accion: string,
    currentEmpresaId?: number,
  ) {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    if (isAdmin) return;
    if (!userEmpresas.includes(lote.idEmpresa)) {
      throw new ForbiddenException(
        `No tiene permisos para ${accion} este lote`,
      );
    }
    if (currentEmpresaId && currentEmpresaId !== lote.idEmpresa) {
      throw new ForbiddenException("El lote no pertenece a la empresa actual");
    }
  }

  private async assertCultivo(idCultivo: number, user: any) {
    const cultivo = await this.cultivoRepo.findOne({
      where: { id: idCultivo },
    });
    if (!cultivo)
      throw new BadRequestException("El cultivo indicado no existe");
    if (cultivo.idEmpresa !== null) {
      const isAdmin =
        user.roles?.includes(Roles.SYS_ADMIN) ||
        user.roles?.includes(Roles.ASESOR_ADMIN);
      const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
        Number(e),
      );
      if (!isAdmin && !userEmpresas.includes(cultivo.idEmpresa)) {
        throw new ForbiddenException(
          "No tiene permisos para usar este cultivo",
        );
      }
    }
  }

  private async assertVariedad(
    idVariedad: number,
    idCultivo: number,
    user: any,
  ) {
    const variedad = await this.variedadRepo.findOne({
      where: { id: idVariedad },
    });
    if (!variedad)
      throw new BadRequestException("La variedad indicada no existe");
    if (variedad.idCultivo !== idCultivo) {
      throw new BadRequestException(
        "La variedad no pertenece al cultivo seleccionado",
      );
    }
    if (variedad.idEmpresa !== null) {
      const isAdmin =
        user.roles?.includes(Roles.SYS_ADMIN) ||
        user.roles?.includes(Roles.ASESOR_ADMIN);
      const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
        Number(e),
      );
      if (!isAdmin && !userEmpresas.includes(variedad.idEmpresa)) {
        throw new ForbiddenException(
          "No tiene permisos para usar esta variedad",
        );
      }
    }
  }

  /**
   * Un ítem de catálogo (labor/insumo/costo) se puede usar en una campaña si:
   *  - es global (id_empresa IS NULL), o
   *  - pertenece a la misma empresa que el lote de la campaña.
   */
  private async assertLaborEnScope(
    idLabor: number,
    idEmpresaLote: number,
    user: any,
  ) {
    const labor = await this.laborRepo.findOne({ where: { id: idLabor } });
    if (!labor) throw new BadRequestException("La labor indicada no existe");
    if (labor.idEmpresa !== null && labor.idEmpresa !== idEmpresaLote) {
      throw new ForbiddenException("La labor pertenece a otra empresa");
    }
    if (labor.idEmpresa !== null) {
      const isAdmin =
        user.roles?.includes(Roles.SYS_ADMIN) ||
        user.roles?.includes(Roles.ASESOR_ADMIN);
      const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
        Number(e),
      );
      if (!isAdmin && !userEmpresas.includes(labor.idEmpresa)) {
        throw new ForbiddenException("No tiene permisos para usar esta labor");
      }
    }
  }

  private async assertInsumoEnScope(
    idInsumo: number,
    idEmpresaLote: number,
    user: any,
  ) {
    const insumo = await this.insumoRepo.findOne({ where: { id: idInsumo } });
    if (!insumo) throw new BadRequestException("El insumo indicado no existe");
    if (insumo.idEmpresa !== null && insumo.idEmpresa !== idEmpresaLote) {
      throw new ForbiddenException("El insumo pertenece a otra empresa");
    }
    if (insumo.idEmpresa !== null) {
      const isAdmin =
        user.roles?.includes(Roles.SYS_ADMIN) ||
        user.roles?.includes(Roles.ASESOR_ADMIN);
      const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
        Number(e),
      );
      if (!isAdmin && !userEmpresas.includes(insumo.idEmpresa)) {
        throw new ForbiddenException("No tiene permisos para usar este insumo");
      }
    }
  }

  private async assertCostoEnScope(
    idCosto: number,
    idEmpresaLote: number,
    user: any,
  ) {
    const costo = await this.costoRepo.findOne({ where: { id: idCosto } });
    if (!costo) throw new BadRequestException("El costo indicado no existe");
    if (costo.idEmpresa !== null && costo.idEmpresa !== idEmpresaLote) {
      throw new ForbiddenException("El costo pertenece a otra empresa");
    }
    if (costo.idEmpresa !== null) {
      const isAdmin =
        user.roles?.includes(Roles.SYS_ADMIN) ||
        user.roles?.includes(Roles.ASESOR_ADMIN);
      const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
        Number(e),
      );
      if (!isAdmin && !userEmpresas.includes(costo.idEmpresa)) {
        throw new ForbiddenException("No tiene permisos para usar este costo");
      }
    }
  }
}
