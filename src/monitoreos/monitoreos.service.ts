import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MonitoreoLote } from "../entities/monitoreo-lote.entity";
import { Campania } from "../entities/campania.entity";
import { Roles } from "../constantes";
import { CreateMonitoreoDto } from "./dto/create-monitoreo.dto";
import { UpdateMonitoreoDto } from "./dto/update-monitoreo.dto";

export interface FindMonitoreosFilters {
  currentEmpresaId?: number;
  empresaIds?: number[];
  campanias?: string[];
  idCampo?: number[];
  idLote?: number[];
  idCultivo?: number[];
  idVariedad?: number[];
  idCampania?: number;
}

@Injectable()
export class MonitoreosService {
  constructor(
    @InjectRepository(MonitoreoLote)
    private monitoreoRepo: Repository<MonitoreoLote>,
    @InjectRepository(Campania) private campaniaRepo: Repository<Campania>,
  ) {}

  // ---------------------------------------------------------------------------
  // Listado (con los mismos filtros de scope que /campanias)
  // ---------------------------------------------------------------------------
  /**
   * Lista monitoreos según el scope del usuario.
   *
   *  - sys-admin: ve todos. Si llega `currentEmpresaId` filtra a esa empresa.
   *  - asesor / productor: ve solo monitoreos de producciones de lotes cuyas
   *    empresas estén en su `idEmpresas`.
   *
   * Trae `campania` (+ lote, campo, cultivo, variedad) para que la grilla
   * muestre productor/lote/cultivo sin un segundo fetch.
   */
  async findAll(user: any, filters: FindMonitoreosFilters = {}) {
    const qb = this.monitoreoRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.campania", "c")
      .leftJoinAndSelect("c.lote", "lote")
      .leftJoinAndSelect("lote.campo", "campo")
      .leftJoinAndSelect("c.cultivo", "cultivo")
      .leftJoinAndSelect("c.variedad", "variedad")
      .where("m.activo = true");

    this.aplicarScope(qb, user, filters);

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
          {
            campos,
          },
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
    if (filters.idCampania) {
      qb.andWhere("m.id_campania = :idCampania", {
        idCampania: filters.idCampania,
      });
    }

    qb.orderBy("m.fecha", "DESC")
      .addOrderBy("m.hora", "DESC")
      .addOrderBy("m.id", "DESC");
    return qb.getMany();
  }

  async findOne(id: number, user: any): Promise<MonitoreoLote> {
    const monitoreo = await this.monitoreoRepo.findOne({
      where: { id },
      relations: {
        campania: { lote: { campo: true }, cultivo: true, variedad: true },
      },
    });
    if (!monitoreo || !monitoreo.activo) {
      throw new NotFoundException("Monitoreo no encontrado");
    }
    await this.assertCampaniaAcceso(monitoreo.campania, user);
    return monitoreo;
  }

  /** Monitoreos de una producción (para /campanias/:id). */
  async findByCampania(
    idCampania: number,
    user: any,
  ): Promise<MonitoreoLote[]> {
    const campania = await this.campaniaOrThrow(idCampania);
    await this.assertCampaniaAcceso(campania, user);
    return this.monitoreoRepo.find({
      where: { idCampania, activo: true },
      order: { fecha: "DESC", hora: "DESC", id: "DESC" },
    });
  }

  async create(dto: CreateMonitoreoDto, user: any): Promise<MonitoreoLote> {
    const campania = await this.campaniaOrThrow(dto.idCampania);
    await this.assertCampaniaAcceso(campania, user);
    const monitoreo = this.monitoreoRepo.create({
      idCampania: campania.id,
      fecha: dto.fecha,
      hora: dto.hora,
      diagnostico: dto.diagnostico.trim(),
      observaciones: dto.observaciones?.trim()
        ? dto.observaciones.trim()
        : null,
      creadoPorUid: user.firebaseUid ?? user.id ?? null,
      activo: true,
    });
    return this.monitoreoRepo.save(monitoreo);
  }

  async update(
    id: number,
    dto: UpdateMonitoreoDto,
    user: any,
  ): Promise<MonitoreoLote> {
    const monitoreo = await this.findOne(id, user);
    if (dto.fecha !== undefined) monitoreo.fecha = dto.fecha;
    if (dto.hora !== undefined) monitoreo.hora = dto.hora;
    if (dto.diagnostico !== undefined)
      monitoreo.diagnostico = dto.diagnostico.trim();
    if (dto.observaciones !== undefined)
      monitoreo.observaciones = dto.observaciones?.trim()
        ? dto.observaciones.trim()
        : null;
    return this.monitoreoRepo.save(monitoreo);
  }

  async remove(id: number, user: any): Promise<{ ok: boolean }> {
    const monitoreo = await this.findOne(id, user);
    monitoreo.activo = false;
    await this.monitoreoRepo.save(monitoreo);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Helpers de scope (mismo patrón que campanias: sys-admin todo, resto sus empresas)
  // ---------------------------------------------------------------------------
  private aplicarScope(qb: any, user: any, filters: FindMonitoreosFilters) {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    if (filters.empresaIds && filters.empresaIds.length > 0) {
      const ids = isAdmin
        ? filters.empresaIds
        : filters.empresaIds.filter((id) => userEmpresas.includes(id));
      if (ids.length === 0) {
        qb.andWhere("1 = 0");
        return;
      }
      qb.andWhere("lote.id_empresa IN (:...ids)", { ids });
    } else if (filters.currentEmpresaId) {
      const id = Number(filters.currentEmpresaId);
      if (!isAdmin && !userEmpresas.includes(id)) {
        qb.andWhere("1 = 0");
        return;
      }
      qb.andWhere("lote.id_empresa = :empresaId", { empresaId: id });
    } else if (!isAdmin) {
      if (userEmpresas.length === 0) {
        qb.andWhere("1 = 0");
        return;
      }
      qb.andWhere("lote.id_empresa IN (:...ids)", { ids: userEmpresas });
    }
  }

  private async campaniaOrThrow(idCampania: number): Promise<Campania> {
    const campania = await this.campaniaRepo.findOne({
      where: { id: idCampania },
      relations: { lote: true },
    });
    if (!campania) throw new NotFoundException("Producción no encontrada");
    return campania;
  }

  private async assertCampaniaAcceso(
    campania: Campania | null,
    user: any,
  ): Promise<void> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    if (isAdmin) return;
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );
    const idEmpresa = campania?.lote?.idEmpresa;
    if (!campania || idEmpresa == null || !userEmpresas.includes(idEmpresa)) {
      throw new ForbiddenException("No tiene permisos sobre esta producción");
    }
  }
}
