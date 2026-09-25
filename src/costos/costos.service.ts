import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Costo } from "../entities/costo.entity";
import { CreateCostoDto } from "./dto/create-costo.dto";
import { UpdateCostoDto } from "./dto/update-costo.dto";
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
export class CostosService {
  constructor(
    @InjectRepository(Costo)
    private costoRepository: Repository<Costo>,
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
    const query = this.costoRepository.createQueryBuilder("costo");

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    // Filtros unificados para todos los roles (sys-admin, asesor, productor):
    //  - global              -> solo ítems globales (sin empresa ni dueño)
    //  - empresa + empresa   -> solo ítems de esa empresa
    //  - empresa (sin valor) -> lista vacía
    //  - todas (default)     -> globales + empresas del usuario + propios del
    //                          asesor (+ los del asesor de la empresa actual)
    //                          (para admins, que ven todas las empresas: todos)
    if (scope === "global") {
      query
        .andWhere("costo.id_empresa IS NULL")
        .andWhere("costo.uid_propietario IS NULL");
    } else if (scope === "asesor") {
      // Ítems de asesor (con dueño). Opcionalmente de un asesor puntual.
      query.andWhere("costo.uid_propietario IS NOT NULL");
      if (uidAsesor) {
        query.andWhere("costo.uid_propietario = :filtroAsesor", {
          filtroAsesor: uidAsesor,
        });
      }
      if (!isAdmin) {
        const idsAsesor: number[] = (user.idEmpresas || [])
          .map((e: any) => Number(e))
          .filter((n) => Number.isFinite(n) && n > 0);
        await aplicarVisibilidadAlcance({
          qb: query,
          alias: "costo",
          user,
          ids: idsAsesor,
          currentEmpresaId,
          cache: this.cache,
          soloConDuenio: true,
        });
      }
    } else if (scope === "empresa") {
      if (currentEmpresaId) {
        query.andWhere("costo.id_empresa = :companyId", {
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
          alias: "costo",
          user,
          ids,
          currentEmpresaId,
          cache: this.cache,
        });
      }
    }

    if (soloActivos) {
      query.andWhere("costo.activo = true");
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.costoRepository.findOne({ where: { id, activo: true } });
  }

  async create(
    createCostoDto: CreateCostoDto,
    user: any,
    currentEmpresaId?: number,
  ) {
    const { alcance, uidAsesor, ...resto } = createCostoDto;
    const scope = await resolverAlcanceCreate({
      alcance,
      uidAsesor,
      idEmpresa: createCostoDto.idEmpresa,
      currentEmpresaId,
      user,
      cache: this.cache,
    });

    const nombre = normalizeNombre(createCostoDto.nombre);
    await assertNombreUnico(
      this.costoRepository,
      nombre,
      scope.idEmpresa,
      undefined,
      scope.uidPropietario,
    );

    try {
      const costo = this.costoRepository.create({
        ...resto,
        nombre,
        uidPropietario: scope.uidPropietario,
        idEmpresa: scope.idEmpresa,
      });
      return await this.costoRepository.save(costo);
    } catch (e) {
      translateUniqueViolation(e, "costo");
    }
  }

  async update(id: number, updateCostoDto: UpdateCostoDto, user: any) {
    const costo = await this.costoRepository.findOne({ where: { id } });
    if (!costo) {
      throw new NotFoundException("Costo no encontrado");
    }

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    exigirEdicionAlcance(costo, user, userEmpresas, "costo");

    // Cambio de alcance (explícito) o movimiento legacy entre empresas.
    if (updateCostoDto.alcance !== undefined) {
      const cambio = await resolverAlcanceCambio({
        alcance: updateCostoDto.alcance,
        uidAsesor: updateCostoDto.uidAsesor,
        idEmpresa: updateCostoDto.idEmpresa,
        actual: {
          uidPropietario: costo.uidPropietario,
          idEmpresa: costo.idEmpresa,
        },
        user,
        cache: this.cache,
      });
      if (cambio) {
        await assertNombreUnico(
          this.costoRepository,
          normalizeNombre(updateCostoDto.nombre ?? costo.nombre),
          cambio.idEmpresa,
          id,
          cambio.uidPropietario,
        );
        costo.uidPropietario = cambio.uidPropietario;
        costo.idEmpresa = cambio.idEmpresa;
      }
    } else if (
      updateCostoDto.idEmpresa !== undefined &&
      updateCostoDto.idEmpresa !== costo.idEmpresa
    ) {
      if (costo.uidPropietario != null) {
        throw new ForbiddenException(
          "Para cambiar el alcance de este costo indique alcance",
        );
      }
      const nuevaEmpresa = updateCostoDto.idEmpresa;
      if (!isAdmin) {
        if (nuevaEmpresa === null || !userEmpresas.includes(nuevaEmpresa)) {
          throw new ForbiddenException(
            "No tiene permisos para cambiar el alcance a esa empresa",
          );
        }
      }
      await assertNombreUnico(
        this.costoRepository,
        normalizeNombre(updateCostoDto.nombre ?? costo.nombre),
        nuevaEmpresa,
        id,
        null,
      );
      costo.idEmpresa = nuevaEmpresa;
    }

    if (updateCostoDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateCostoDto.nombre);
      if (nuevoNombre !== costo.nombre) {
        await assertNombreUnico(
          this.costoRepository,
          nuevoNombre,
          costo.idEmpresa,
          id,
          costo.uidPropietario,
        );
        costo.nombre = nuevoNombre;
      }
    }

    if (updateCostoDto.descripcion !== undefined) {
      costo.descripcion = updateCostoDto.descripcion;
    }

    if (updateCostoDto.precioUnitario !== undefined) {
      costo.precioUnitario = updateCostoDto.precioUnitario;
    }

    if (updateCostoDto.unidad !== undefined) {
      costo.unidad = updateCostoDto.unidad;
    }

    if (updateCostoDto.activo !== undefined) {
      costo.activo = updateCostoDto.activo;
    }

    try {
      return await this.costoRepository.save(costo);
    } catch (e) {
      translateUniqueViolation(e, "costo");
    }
  }
}
