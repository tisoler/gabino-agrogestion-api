import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from 'src/constantes';
import { NotificacionesService } from '../notificaciones/notificaciones.service';import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Prescripcion } from '../entities/prescripcion.entity';
import { PrescripcionInsumo } from '../entities/prescripcion-insumo.entity';
import { Campania } from '../entities/campania.entity';
import { Labor } from '../entities/labor.entity';
import { Insumo } from '../entities/insumo.entity';
import { CampaniaLabor } from '../entities/campania-labor.entity';
import { CampaniaInsumo } from '../entities/campania-insumo.entity';
import { Lote } from '../entities/lote.entity';
import { CreatePrescripcionDto } from './dto/create-prescripcion.dto';

export interface FindPrescripcionesFilters {
  empresaId?: number;
  empresaIds?: number[];
  idCampania?: number;
  campanias?: string[];
  idLote?: number;
  idLabor?: number;
  idInsumo?: number;
}

export interface PrescripcionListItem {
  id: number;
  fecha: string;
  idCampania: number;
  idLabor: number;
  totalHaAplicacion: number;
  campania: Campania | null;
  labor: Labor | null;
  insumoCount: number;
}

@Injectable()
export class PrescripcionesService {
  constructor(
    @InjectRepository(Prescripcion) private prescripcionRepo: Repository<Prescripcion>,
    @InjectRepository(PrescripcionInsumo) private prescripcionInsumoRepo: Repository<PrescripcionInsumo>,
    @InjectRepository(Campania) private campaniaRepo: Repository<Campania>,
    @InjectRepository(Lote) private loteRepo: Repository<Lote>,
    @InjectRepository(Labor) private laborRepo: Repository<Labor>,
    @InjectRepository(Insumo) private insumoRepo: Repository<Insumo>,
    @InjectRepository(CampaniaLabor) private campaniaLaborRepo: Repository<CampaniaLabor>,
    @InjectRepository(CampaniaInsumo) private campaniaInsumoRepo: Repository<CampaniaInsumo>,
    private dataSource: DataSource,
    private notificaciones: NotificacionesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Listado con filtros
  // ---------------------------------------------------------------------------
  async findAll(user: any, filters: FindPrescripcionesFilters = {}): Promise<PrescripcionListItem[]> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    const qb = this.prescripcionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.campania', 'campania')
      .leftJoinAndSelect('campania.lote', 'lote')
      .leftJoinAndSelect('campania.cultivo', 'cultivo')
      .leftJoinAndSelect('p.labor', 'labor');

    if (filters.empresaIds && filters.empresaIds.length > 0) {
      const ids = isAdmin
        ? filters.empresaIds
        : filters.empresaIds.filter((id) => userEmpresas.includes(id));
      if (ids.length === 0) return [];
      qb.andWhere('lote.id_empresa IN (:...empresaIds)', { empresaIds: ids });
    } else if (filters.empresaId) {
      const id = Number(filters.empresaId);
      if (!isAdmin && !userEmpresas.includes(id)) return [];
      qb.andWhere('lote.id_empresa = :empresaId', { empresaId: id });
    } else if (!isAdmin) {
      if (userEmpresas.length === 0) return [];
      qb.andWhere('lote.id_empresa IN (:...ids)', { ids: userEmpresas });
    }
    if (filters.idCampania) {
      qb.andWhere('p.id_campania = :idCampania', { idCampania: filters.idCampania });
    }
    if (filters.campanias && filters.campanias.length > 0) {
      qb.andWhere('campania.campania IN (:...campanias)', { campanias: filters.campanias });
    }
    if (filters.idLote) {
      qb.andWhere('campania.id_lote = :idLote', { idLote: filters.idLote });
    }
    if (filters.idLabor) {
      qb.andWhere('p.id_labor = :idLabor', { idLabor: filters.idLabor });
    }
    if (filters.idInsumo) {
      qb.innerJoin('p.insumos', 'pi', 'pi.id_insumo = :idInsumo', { idInsumo: filters.idInsumo });
    }

    qb.orderBy('p.fecha', 'DESC').addOrderBy('p.id', 'DESC');
    const prescripciones = await qb.getMany();

    if (prescripciones.length === 0) return [];

    const ids = prescripciones.map((p) => p.id);
    const insumos = await this.prescripcionInsumoRepo
      .createQueryBuilder('pi')
      .select('pi.id_prescripcion', 'id_prescripcion')
      .addSelect('COUNT(*)', 'cnt')
      .where('pi.id_prescripcion IN (:...ids)', { ids })
      .groupBy('pi.id_prescripcion')
      .getRawMany<{ id_prescripcion: number; cnt: string }>();

    const countByPrescripcion = new Map<number, number>();
    for (const row of insumos) {
      countByPrescripcion.set(Number(row.id_prescripcion), Number(row.cnt));
    }

    return prescripciones.map<PrescripcionListItem>((p) => ({
      id: p.id,
      fecha: p.fecha,
      idCampania: p.idCampania,
      idLabor: p.idLabor,
      totalHaAplicacion: p.totalHaAplicacion,
      campania: p.campania ?? null,
      labor: p.labor ?? null,
      insumoCount: countByPrescripcion.get(p.id) ?? 0,
    }));
  }

  // ---------------------------------------------------------------------------
  // Detalle
  // ---------------------------------------------------------------------------
  async findOne(id: number) {
    const prescripcion = await this.prescripcionRepo.findOne({
      where: { id },
      relations: {
        campania: { lote: true, cultivo: true, variedad: true },
        labor: true,
        insumos: { insumo: true },
      },
      order: { insumos: { id: 'ASC' } },
    });
    if (!prescripcion) throw new NotFoundException('Prescripción no encontrada');
    return prescripcion;
  }

  // ---------------------------------------------------------------------------
  // Crear
  // ---------------------------------------------------------------------------
  async create(dto: CreatePrescripcionDto, user: any) {
    const campania = await this.campaniaRepo.findOne({
      where: { id: dto.idCampania },
      relations: ['lote'],
    });
    if (!campania) throw new BadRequestException('La campaña indicada no existe');
    if (!campania.lote) throw new BadRequestException('La campaña no tiene lote asignado');

    const labor = await this.laborRepo.findOne({ where: { id: dto.idLabor } });
    if (!labor) throw new BadRequestException('La labor indicada no existe');

    const insumosDto = dto.insumos ?? [];
    const insumosValidos: Insumo[] = [];
    if (insumosDto.length > 0) {
      const ids = insumosDto.map((i) => i.idInsumo);
      const found = await this.insumoRepo.find({ where: { id: In(ids) } });
      const foundIds = new Set(found.map((f) => f.id));
      for (const id of ids) {
        if (!foundIds.has(id)) throw new BadRequestException(`El insumo ${id} no existe`);
      }
      insumosValidos.push(...found);
    }

    const totalHa = Number(dto.totalHaAplicacion) || 0;

    const result = await this.dataSource.transaction(async (manager) => {
      const prescripcionRepo = manager.getRepository(Prescripcion);
      const insumoRelRepo = manager.getRepository(PrescripcionInsumo);
      const campaniaLaborRepo = manager.getRepository(CampaniaLabor);
      const campaniaInsumoRepo = manager.getRepository(CampaniaInsumo);

      const prescripcion = prescripcionRepo.create({
        fecha: dto.fecha,
        idCampania: dto.idCampania,
        idLabor: dto.idLabor,
        totalHaAplicacion: totalHa,
      });
      const saved = await prescripcionRepo.save(prescripcion);

      for (const i of insumosDto) {
        const rel = insumoRelRepo.create({
          idPrescripcion: saved.id,
          idInsumo: i.idInsumo,
          cantidadPorHa: Number(i.cantidadPorHa) || 0,
          cantidadTotal: Number(i.cantidadTotal) || 0,
        });
        await insumoRelRepo.save(rel);
      }

      // Asignar la labor y los insumos a la campaña (valores de referencia).
      const laborRel = campaniaLaborRepo.create({
        idCampania: dto.idCampania,
        idLabor: dto.idLabor,
        fecha: dto.fecha,
        superficieLaboreada: totalHa,
        costoLaborHa: labor.precioUnitario ?? 0,
      });
      await campaniaLaborRepo.save(laborRel);

      const insumoPorId = new Map<number, Insumo>(insumosValidos.map((i) => [i.id, i]));
      for (const i of insumosDto) {
        const ins = insumoPorId.get(i.idInsumo);
        const rel = campaniaInsumoRepo.create({
          idCampania: dto.idCampania,
          idInsumo: i.idInsumo,
          unidadesHa: Number(i.cantidadPorHa) || 0,
          costoUnidad: ins?.precioUnitario ?? 0,
          // Al igual que labores, la superficie aplicada es la de la prescripción.
          superficieAplicada: totalHa,
        });
        await campaniaInsumoRepo.save(rel);
      }

      return saved.id;
    });

    await this.notificarNuevaPrescripcion(result, campania, user);
    return this.findOne(result);
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
      tipo: 'prescripcion',
      mensaje: `Nueva prescripción en ${campania.nombre} (${campania.campania}) · ${loteNombre}`,
      idCampania: campania.id,
      idPrescripcion: prescripcionId,
    });
  }
}
