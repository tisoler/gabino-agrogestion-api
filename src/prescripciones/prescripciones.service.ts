import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Roles } from "src/constantes";
import { NotificacionesService } from "../notificaciones/notificaciones.service";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Prescripcion } from "../entities/prescripcion.entity";
import { PrescripcionInsumo } from "../entities/prescripcion-insumo.entity";
import { PrescripcionCampania } from "../entities/prescripcion-campania.entity";
import { Campania } from "../entities/campania.entity";
import { Labor } from "../entities/labor.entity";
import { Insumo } from "../entities/insumo.entity";
import { CampaniaLabor } from "../entities/campania-labor.entity";
import { CampaniaInsumo } from "../entities/campania-insumo.entity";
import { Lote } from "../entities/lote.entity";
import { CreatePrescripcionDto } from "./dto/create-prescripcion.dto";
import { PrescripcionesPdfService } from "./prescripciones-pdf.service";
import { SpacesService } from "../spaces/spaces.service";

export interface FindPrescripcionesFilters {
  empresaId?: number;
  empresaIds?: number[];
  idCampania?: number;
  campanias?: string[];
  idCampo?: number[];
  idLote?: number[];
  idLabor?: number[];
  idInsumo?: number[];
}

export interface PrescripcionListItem {
  id: number;
  fecha: string;
  idCampania: number | null;
  idLabor: number;
  totalHaAplicacion: number;
  anulada: boolean;
  campania: Campania | null;
  labor: Labor | null;
  insumoCount: number;
  lotesCount: number;
}

@Injectable()
export class PrescripcionesService {
  constructor(
    @InjectRepository(Prescripcion)
    private prescripcionRepo: Repository<Prescripcion>,
    @InjectRepository(PrescripcionInsumo)
    private prescripcionInsumoRepo: Repository<PrescripcionInsumo>,
    @InjectRepository(PrescripcionCampania)
    private prescripcionCampaniaRepo: Repository<PrescripcionCampania>,
    @InjectRepository(Campania) private campaniaRepo: Repository<Campania>,
    @InjectRepository(Lote) private loteRepo: Repository<Lote>,
    @InjectRepository(Labor) private laborRepo: Repository<Labor>,
    @InjectRepository(Insumo) private insumoRepo: Repository<Insumo>,
    @InjectRepository(CampaniaLabor)
    private campaniaLaborRepo: Repository<CampaniaLabor>,
    @InjectRepository(CampaniaInsumo)
    private campaniaInsumoRepo: Repository<CampaniaInsumo>,
    private dataSource: DataSource,
    private notificaciones: NotificacionesService,
    private pdfService: PrescripcionesPdfService,
    private spaces: SpacesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Listado con filtros
  // ---------------------------------------------------------------------------
  async findAll(
    user: any,
    filters: FindPrescripcionesFilters = {},
  ): Promise<PrescripcionListItem[]> {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    const qb = this.prescripcionRepo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.campania", "campania")
      .leftJoinAndSelect("campania.lote", "lote")
      .leftJoinAndSelect("lote.campo", "campo")
      .leftJoinAndSelect("campania.cultivo", "cultivo")
      .leftJoinAndSelect("p.labor", "labor");

    if (filters.empresaIds && filters.empresaIds.length > 0) {
      const ids = isAdmin
        ? filters.empresaIds
        : filters.empresaIds.filter((id) => userEmpresas.includes(id));
      if (ids.length === 0) return [];
      qb.andWhere("lote.id_empresa IN (:...empresaIds)", { empresaIds: ids });
    } else if (filters.empresaId) {
      const id = Number(filters.empresaId);
      if (!isAdmin && !userEmpresas.includes(id)) return [];
      qb.andWhere("lote.id_empresa = :empresaId", { empresaId: id });
    } else if (!isAdmin) {
      if (userEmpresas.length === 0) return [];
      qb.andWhere("lote.id_empresa IN (:...ids)", { ids: userEmpresas });
    }
    if (filters.idCampania) {
      // Vale tanto si es la producción principal como si es uno de los lotes.
      qb.andWhere(
        `(p.id_campania = :idCampania OR EXISTS (
           SELECT 1 FROM prescripcion_campania pc
           WHERE pc.id_prescripcion = p.id AND pc.id_campania = :idCampania
         ))`,
        { idCampania: filters.idCampania },
      );
    }
    if (filters.campanias && filters.campanias.length > 0) {
      qb.andWhere("campania.campania IN (:...campanias)", {
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
      qb.andWhere("campania.id_lote IN (:...idLote)", {
        idLote: filters.idLote,
      });
    }
    if (filters.idLabor && filters.idLabor.length > 0) {
      qb.andWhere("p.id_labor IN (:...idLabor)", { idLabor: filters.idLabor });
    }
    if (filters.idInsumo && filters.idInsumo.length > 0) {
      qb.innerJoin("p.insumos", "pi", "pi.id_insumo IN (:...idInsumo)", {
        idInsumo: filters.idInsumo,
      });
    }

    qb.orderBy("p.fecha", "DESC").addOrderBy("p.id", "DESC");
    const prescripciones = await qb.getMany();

    if (prescripciones.length === 0) return [];

    const ids = prescripciones.map((p) => p.id);
    const [insumos, loteRows] = await Promise.all([
      this.prescripcionInsumoRepo
        .createQueryBuilder("pi")
        .select("pi.id_prescripcion", "id_prescripcion")
        .addSelect("COUNT(*)", "cnt")
        .where("pi.id_prescripcion IN (:...ids)", { ids })
        .groupBy("pi.id_prescripcion")
        .getRawMany<{ id_prescripcion: number; cnt: string }>(),
      this.prescripcionCampaniaRepo
        .createQueryBuilder("pc")
        .select("pc.id_prescripcion", "id_prescripcion")
        .addSelect("COUNT(*)", "cnt")
        .where("pc.id_prescripcion IN (:...ids)", { ids })
        .groupBy("pc.id_prescripcion")
        .getRawMany<{ id_prescripcion: number; cnt: string }>(),
    ]);

    const countByPrescripcion = new Map<number, number>();
    for (const row of insumos) {
      countByPrescripcion.set(Number(row.id_prescripcion), Number(row.cnt));
    }
    const lotesByPrescripcion = new Map<number, number>();
    for (const row of loteRows) {
      lotesByPrescripcion.set(Number(row.id_prescripcion), Number(row.cnt));
    }

    return prescripciones.map<PrescripcionListItem>((p) => ({
      id: p.id,
      fecha: p.fecha,
      idCampania: p.idCampania,
      idLabor: p.idLabor,
      totalHaAplicacion: p.totalHaAplicacion,
      anulada: p.anulada,
      campania: p.campania ?? null,
      labor: p.labor ?? null,
      insumoCount: countByPrescripcion.get(p.id) ?? 0,
      lotesCount: lotesByPrescripcion.get(p.id) ?? 0,
    }));
  }

  // ---------------------------------------------------------------------------
  // Anular / recuperar (borrado lógico)
  // ---------------------------------------------------------------------------
  async setAnulada(id: number, anulada: boolean, user: any) {
    const prescripcion = await this.prescripcionRepo.findOne({
      where: { id },
      relations: {
        campania: { lote: true },
        labor: true,
        insumos: { insumo: true },
        lotes: true,
      },
      order: { lotes: { id: "ASC" } },
    });
    if (!prescripcion)
      throw new NotFoundException("Prescripción no encontrada");
    this.assertEmpresaAcceso(
      prescripcion.campania?.lote?.idEmpresa,
      user,
      "modificar esta prescripción",
    );

    await this.dataSource.transaction(async (manager) => {
      const prescripcionRepo = manager.getRepository(Prescripcion);
      const campaniaLaborRepo = manager.getRepository(CampaniaLabor);
      const campaniaInsumoRepo = manager.getRepository(CampaniaInsumo);

      // Al anular o recuperar se quitan/regeneran la labor y los insumos que
      // esta prescripción aporta a cada producción (campania_labor /
      // campania_insumo), identificados por idPrescripcion.
      await campaniaLaborRepo.delete({ idPrescripcion: id });
      await campaniaInsumoRepo.delete({ idPrescripcion: id });

      if (!anulada) {
        // Recuperar: reconstruir las filas por lote, con la superficie de
        // cada uno (mismos valores que create() propagaba).
        const loteRows =
          prescripcion.lotes?.length > 0
            ? prescripcion.lotes
            : prescripcion.idCampania != null
              ? [
                  {
                    idCampania: prescripcion.idCampania,
                    superficieAplicada: prescripcion.totalHaAplicacion,
                  },
                ]
              : [];

        for (const lote of loteRows) {
          const laborRel = campaniaLaborRepo.create({
            idCampania: lote.idCampania,
            idLabor: prescripcion.idLabor,
            fecha: prescripcion.fecha,
            superficieLaboreada: lote.superficieAplicada,
            costoLaborHa: prescripcion.labor?.precioUnitario ?? 0,
            idPrescripcion: prescripcion.id,
          });
          await campaniaLaborRepo.save(laborRel);

          for (const i of prescripcion.insumos ?? []) {
            const rel = campaniaInsumoRepo.create({
              idCampania: lote.idCampania,
              idInsumo: i.idInsumo,
              unidadesHa: i.cantidadPorHa,
              costoUnidad: i.insumo?.precioUnitario ?? 0,
              superficieAplicada: lote.superficieAplicada,
              idPrescripcion: prescripcion.id,
            });
            await campaniaInsumoRepo.save(rel);
          }
        }
      }

      await prescripcionRepo.update(id, { anulada });
    });

    return { id, anulada };
  }

  // ---------------------------------------------------------------------------
  // Detalle
  // ---------------------------------------------------------------------------
  async findOne(id: number, user: any) {
    const prescripcion = await this.prescripcionRepo.findOne({
      where: { id },
      relations: {
        campania: {
          lote: { campo: true, empresa: true },
          cultivo: true,
          variedad: true,
        },
        labor: true,
        insumos: { insumo: true },
        lotes: {
          campania: { lote: { campo: true }, cultivo: true },
        },
      },
      order: { insumos: { id: "ASC" }, lotes: { id: "ASC" } },
    });
    if (!prescripcion)
      throw new NotFoundException("Prescripción no encontrada");
    this.assertEmpresaAcceso(
      prescripcion.campania?.lote?.idEmpresa,
      user,
      "ver esta prescripción",
    );
    return prescripcion;
  }

  // ---------------------------------------------------------------------------
  // PDF para descarga / compartir
  // ---------------------------------------------------------------------------
  /**
   * Genera el PDF de la prescripción (media hoja A4, membrete/pie) y devuelve
   * el buffer. No persiste nada.
   */
  async generarPdf(id: number, user: any): Promise<Buffer> {
    const prescripcion = await this.findOne(id, user);
    return this.pdfService.buildPdf(prescripcion);
  }

  /**
   * Devuelve la URL pública del PDF para compartir por WhatsApp. Si la
   * prescripción ya tiene un PDF generado, reutiliza su URL; si no, lo genera,
   * lo sube al Space y guarda la URL en `pdf_url` para no regenerarlo.
   */
  async compartir(id: number, user: any): Promise<{ url: string }> {
    const prescripcion = await this.findOne(id, user);
    if (prescripcion.pdfUrl) {
      return { url: prescripcion.pdfUrl };
    }

    const key = this.spaces.generarKeyPdf();
    const buffer = await this.pdfService.buildPdf(prescripcion);
    const url = await this.spaces.subirPdf(key, buffer);
    await this.prescripcionRepo.update(id, { pdfUrl: url });
    return { url };
  }

  /**
   * Elimina los PDFs de prescripciones cuya fecha de generación (LastModified
   * en el Space) es anterior o igual a `cutoff`, y limpia la URL guardada en
   * `pdf_url` para que la próxima vez que se comparta se regeneren.
   */
  async limpiarPdfsAntiguos(cutoff: Date): Promise<{ eliminados: number }> {
    const objetos = await this.spaces.listarPdfsAntiguos(cutoff);
    if (objetos.length === 0) {
      return { eliminados: 0 };
    }

    const urls = objetos.map((o) => o.url);
    await this.spaces.eliminarPdfs(objetos.map((o) => o.key));

    await this.prescripcionRepo
      .createQueryBuilder()
      .update()
      .set({ pdfUrl: null })
      .where("pdf_url IN (:...urls)", { urls })
      .execute();

    return { eliminados: urls.length };
  }

  // ---------------------------------------------------------------------------
  // Crear
  // ---------------------------------------------------------------------------
  async create(dto: CreatePrescripcionDto, user: any) {
    const loteDtos = dto.lotes ?? [];
    const campaniaIds = loteDtos.map((l) => l.idCampania);
    if (new Set(campaniaIds).size !== campaniaIds.length) {
      throw new BadRequestException("Hay lotes duplicados en la prescripción");
    }

    const campanias = await this.campaniaRepo.find({
      where: { id: In(campaniaIds) },
      relations: ["lote"],
    });
    if (campanias.length !== campaniaIds.length) {
      throw new BadRequestException(
        "Una de las producciones indicadas no existe",
      );
    }
    if (campanias.some((c) => !c.lote)) {
      throw new BadRequestException(
        "Una de las producciones no tiene lote asignado",
      );
    }
    // Una prescripción abarca lotes de un mismo productor.
    const empresas = new Set(campanias.map((c) => c.lote!.idEmpresa));
    if (empresas.size > 1) {
      throw new BadRequestException(
        "Todos los lotes deben pertenecer al mismo productor",
      );
    }
    this.assertEmpresaAcceso(
      campanias[0].lote!.idEmpresa,
      user,
      "crear prescripciones en esta campaña",
    );

    const labor = await this.laborRepo.findOne({ where: { id: dto.idLabor } });
    if (!labor) throw new BadRequestException("La labor indicada no existe");

    const insumosDto = dto.insumos ?? [];
    const insumosValidos: Insumo[] = [];
    if (insumosDto.length > 0) {
      const ids = insumosDto.map((i) => i.idInsumo);
      const found = await this.insumoRepo.find({ where: { id: In(ids) } });
      const foundIds = new Set(found.map((f) => f.id));
      for (const id of ids) {
        if (!foundIds.has(id))
          throw new BadRequestException(`El insumo ${id} no existe`);
      }
      insumosValidos.push(...found);
    }

    const superficieByCampania = new Map<number, number>(
      loteDtos.map((l) => [l.idCampania, Number(l.superficieAplicada) || 0]),
    );
    const totalHa = loteDtos.reduce(
      (acc, l) => acc + (Number(l.superficieAplicada) || 0),
      0,
    );
    if (totalHa <= 0) {
      throw new BadRequestException(
        "La superficie aplicada debe ser mayor a 0",
      );
    }

    // Orden estable: la primera producción queda en prescripcion.id_campania
    // (referencia principal por compatibilidad).
    const campaniasOrdenadas = [...campanias].sort((a, b) => a.id - b.id);

    const result = await this.dataSource.transaction(async (manager) => {
      const prescripcionRepo = manager.getRepository(Prescripcion);
      const insumoRelRepo = manager.getRepository(PrescripcionInsumo);
      const prescripcionCampaniaRepo =
        manager.getRepository(PrescripcionCampania);
      const campaniaLaborRepo = manager.getRepository(CampaniaLabor);
      const campaniaInsumoRepo = manager.getRepository(CampaniaInsumo);

      const prescripcion = prescripcionRepo.create({
        fecha: dto.fecha,
        idCampania: campaniasOrdenadas[0].id,
        idLabor: dto.idLabor,
        totalHaAplicacion: totalHa,
        observaciones: dto.observaciones?.trim() || null,
      });
      const saved = await prescripcionRepo.save(prescripcion);

      for (const c of campaniasOrdenadas) {
        const loteRel = prescripcionCampaniaRepo.create({
          idPrescripcion: saved.id,
          idCampania: c.id,
          superficieAplicada: superficieByCampania.get(c.id) ?? 0,
        });
        await prescripcionCampaniaRepo.save(loteRel);
      }

      for (const i of insumosDto) {
        const rel = insumoRelRepo.create({
          idPrescripcion: saved.id,
          idInsumo: i.idInsumo,
          cantidadPorHa: Number(i.cantidadPorHa) || 0,
          cantidadTotal: (Number(i.cantidadPorHa) || 0) * totalHa,
        });
        await insumoRelRepo.save(rel);
      }

      // Asignar la labor y los insumos a cada producción afectada (valores de
      // referencia con la superficie de su lote), guardando el id de la
      // prescripción para poder agruparlas visualmente.
      const insumoPorId = new Map<number, Insumo>(
        insumosValidos.map((i) => [i.id, i]),
      );
      for (const c of campaniasOrdenadas) {
        const supLote = superficieByCampania.get(c.id) ?? 0;

        const laborRel = campaniaLaborRepo.create({
          idCampania: c.id,
          idLabor: dto.idLabor,
          fecha: dto.fecha,
          superficieLaboreada: supLote,
          costoLaborHa: labor.precioUnitario ?? 0,
          idPrescripcion: saved.id,
        });
        await campaniaLaborRepo.save(laborRel);

        for (const i of insumosDto) {
          const ins = insumoPorId.get(i.idInsumo);
          const rel = campaniaInsumoRepo.create({
            idCampania: c.id,
            idInsumo: i.idInsumo,
            unidadesHa: Number(i.cantidadPorHa) || 0,
            costoUnidad: ins?.precioUnitario ?? 0,
            superficieAplicada: supLote,
            idPrescripcion: saved.id,
          });
          await campaniaInsumoRepo.save(rel);
        }
      }

      return saved.id;
    });

    await this.notificarNuevaPrescripcion(result, campaniasOrdenadas[0], user);
    return this.findOne(result, user);
  }

  // ---------------------------------------------------------------------------
  // Acceso por empresa
  // ---------------------------------------------------------------------------
  /**
   * Los admins (sys-admin / asesor-admin) acceden a todo; el resto sólo a
   * prescripciones de campañas cuyo lote pertenece a una de sus empresas
   * (mismo patrón que assertCampaniaAcceso de campañas).
   */
  private assertEmpresaAcceso(
    idEmpresa: number | null | undefined,
    user: any,
    accion: string,
  ) {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    if (isAdmin) return;
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );
    if (idEmpresa == null || !userEmpresas.includes(idEmpresa)) {
      throw new ForbiddenException(`No tiene permisos para ${accion}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Notificaciones
  // ---------------------------------------------------------------------------
  /**
   * Cuando un asesor o asesor-admin crea una prescripción para una campaña
   * cuyo lote tiene otro usuario como dueño, le llega una notificación con el
   * link a la prescripción.
   */
  private async notificarNuevaPrescripcion(
    prescripcionId: number,
    campania: Campania,
    user: any,
  ) {
    const esAsesor = user?.roles?.includes(Roles.ASESOR);
    const esAsesorAdmin = user?.roles?.includes(Roles.ASESOR_ADMIN);
    if (!esAsesor && !esAsesorAdmin) return;

    const lote = campania.lote;
    if (!lote?.idUsuario || lote.idUsuario === user.id) return;

    const loteNombre = lote.descripcion?.trim() || `Lote #${lote.id}`;
    await this.notificaciones.crear({
      idUsuario: lote.idUsuario,
      tipo: "prescripcion",
      mensaje: `Nueva prescripción en ${campania.campania} · ${loteNombre}`,
      idCampania: campania.id,
      idPrescripcion: prescripcionId,
    });
  }
}
