import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Labor } from "../entities/labor.entity";
import { CreateLaborDto } from "./dto/create-labor.dto";
import { UpdateLaborDto } from "./dto/update-labor.dto";
import { Roles } from "src/constantes";
import {
  assertNombreUnico,
  normalizeNombre,
  translateUniqueViolation,
} from "../utils/nombre";
import {
  aplicarVisibilidadAlcance,
  exigirEdicionAlcance,
  resolverAlcanceCambio,
  resolverAlcanceCreate,
} from "../utils/alcance";
import { FirestoreCacheService } from "../cache/firestore-cache.service";

@Injectable()
export class LaboresService {
  constructor(
    @InjectRepository(Labor)
    private laborRepository: Repository<Labor>,
    private cache: FirestoreCacheService,
  ) {}

  async findAll(
    user: any,
    all?: boolean,
    companyIds?: string,
    currentEmpresaId?: number,
    soloActivos?: boolean,
    scope?: string,
    uidAsesor?: string,
  ) {
    const query = this.laborRepository.createQueryBuilder("labor");

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    // Filtros unificados para todos los roles (sys-admin, asesor, productor):
    if (scope === "global") {
      query
        .andWhere("labor.id_empresa IS NULL")
        .andWhere("labor.uid_propietario IS NULL");
    } else if (scope === "asesor") {
      // Ítems de asesor (con dueño). Opcionalmente de un asesor puntual.
      query.andWhere("labor.uid_propietario IS NOT NULL");
      if (uidAsesor) {
        query.andWhere("labor.uid_propietario = :filtroAsesor", {
          filtroAsesor: uidAsesor,
        });
      }
      if (!isAdmin) {
        const idsAsesor: number[] = (user.idEmpresas || [])
          .map((e: any) => Number(e))
          .filter((n) => Number.isFinite(n) && n > 0);
        await aplicarVisibilidadAlcance({
          qb: query,
          alias: "labor",
          user,
          ids: idsAsesor,
          currentEmpresaId,
          cache: this.cache,
          soloConDuenio: true,
        });
      }
    } else if (scope === "empresa") {
      if (currentEmpresaId) {
        query.andWhere("labor.id_empresa = :companyId", {
          companyId: currentEmpresaId,
        });
      } else {
        return [];
      }
    } else {
      if (!isAdmin) {
        const ids: number[] = (user.idEmpresas || [])
          .map((e: any) => Number(e))
          .filter((n) => Number.isFinite(n) && n > 0);
        await aplicarVisibilidadAlcance({
          qb: query,
          alias: "labor",
          user,
          ids,
          currentEmpresaId,
          cache: this.cache,
        });
      }
    }

    if (soloActivos) {
      query.andWhere("labor.activo = true");
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.laborRepository.findOne({ where: { id, activo: true } });
  }

  async create(
    createLaborDto: CreateLaborDto,
    user: any,
    currentEmpresaId?: number,
  ) {
    const { alcance, uidAsesor, ...resto } = createLaborDto;
    const scope = await resolverAlcanceCreate({
      alcance,
      uidAsesor,
      idEmpresa: createLaborDto.idEmpresa,
      currentEmpresaId,
      user,
      cache: this.cache,
    });

    const nombre = normalizeNombre(createLaborDto.nombre);
    await assertNombreUnico(
      this.laborRepository,
      nombre,
      scope.idEmpresa,
      undefined,
      scope.uidPropietario,
    );

    try {
      const labor = this.laborRepository.create({
        ...resto,
        nombre,
        uidPropietario: scope.uidPropietario,
        idEmpresa: scope.idEmpresa,
      });
      return await this.laborRepository.save(labor);
    } catch (e) {
      translateUniqueViolation(e, "labor");
    }
  }

  async update(id: number, updateLaborDto: UpdateLaborDto, user: any) {
    const labor = await this.laborRepository.findOne({ where: { id } });
    if (!labor) {
      throw new NotFoundException("Labor no encontrada");
    }

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    exigirEdicionAlcance(labor, user, userEmpresas, "labor");

    // Cambio de alcance (explícito) o movimiento legacy entre empresas.
    if (updateLaborDto.alcance !== undefined) {
      const cambio = await resolverAlcanceCambio({
        alcance: updateLaborDto.alcance,
        uidAsesor: updateLaborDto.uidAsesor,
        idEmpresa: updateLaborDto.idEmpresa,
        actual: {
          uidPropietario: labor.uidPropietario,
          idEmpresa: labor.idEmpresa,
        },
        user,
        cache: this.cache,
      });
      if (cambio) {
        await assertNombreUnico(
          this.laborRepository,
          normalizeNombre(updateLaborDto.nombre ?? labor.nombre),
          cambio.idEmpresa,
          id,
          cambio.uidPropietario,
        );
        labor.uidPropietario = cambio.uidPropietario;
        labor.idEmpresa = cambio.idEmpresa;
      }
    } else if (
      updateLaborDto.idEmpresa !== undefined &&
      updateLaborDto.idEmpresa !== labor.idEmpresa
    ) {
      if (labor.uidPropietario != null) {
        throw new ForbiddenException(
          "Para cambiar el alcance de esta labor indique alcance",
        );
      }
      const nuevaEmpresa = updateLaborDto.idEmpresa;
      if (!isAdmin) {
        if (nuevaEmpresa === null || !userEmpresas.includes(nuevaEmpresa)) {
          throw new ForbiddenException(
            "No tiene permisos para cambiar el alcance a esa empresa",
          );
        }
      }
      await assertNombreUnico(
        this.laborRepository,
        normalizeNombre(updateLaborDto.nombre ?? labor.nombre),
        nuevaEmpresa,
        id,
        null,
      );
      labor.idEmpresa = nuevaEmpresa;
    }

    if (updateLaborDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateLaborDto.nombre);
      if (nuevoNombre !== labor.nombre) {
        await assertNombreUnico(
          this.laborRepository,
          nuevoNombre,
          labor.idEmpresa,
          id,
          labor.uidPropietario,
        );
        labor.nombre = nuevoNombre;
      }
    }

    if (updateLaborDto.descripcion !== undefined) {
      labor.descripcion = updateLaborDto.descripcion;
    }

    if (updateLaborDto.precioUnitario !== undefined) {
      labor.precioUnitario = updateLaborDto.precioUnitario;
    }

    if (updateLaborDto.activo !== undefined) {
      labor.activo = updateLaborDto.activo;
    }

    try {
      return await this.laborRepository.save(labor);
    } catch (e) {
      translateUniqueViolation(e, "labor");
    }
  }
}
