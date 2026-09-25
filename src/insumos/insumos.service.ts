import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Insumo } from "../entities/insumo.entity";
import { CategoriaInsumo } from "../entities/categoria-insumo.entity";
import { CreateInsumoDto } from "./dto/create-insumo.dto";
import { UpdateInsumoDto } from "./dto/update-insumo.dto";
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
export class InsumosService {
  constructor(
    @InjectRepository(Insumo)
    private insumoRepository: Repository<Insumo>,
    @InjectRepository(CategoriaInsumo)
    private categoriaRepository: Repository<CategoriaInsumo>,
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
    const query = this.insumoRepository
      .createQueryBuilder("insumo")
      .leftJoinAndSelect("insumo.categoria", "categoria");

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    // Filtros unificados para todos los roles (sys-admin, asesor, productor):
    if (scope === "global") {
      query
        .andWhere("insumo.id_empresa IS NULL")
        .andWhere("insumo.uid_propietario IS NULL");
    } else if (scope === "asesor") {
      // Ítems de asesor (con dueño). Opcionalmente de un asesor puntual.
      query.andWhere("insumo.uid_propietario IS NOT NULL");
      if (uidAsesor) {
        query.andWhere("insumo.uid_propietario = :filtroAsesor", {
          filtroAsesor: uidAsesor,
        });
      }
      if (!isAdmin) {
        const idsAsesor: number[] = (user.idEmpresas || [])
          .map((e: any) => Number(e))
          .filter((n) => Number.isFinite(n) && n > 0);
        await aplicarVisibilidadAlcance({
          qb: query,
          alias: "insumo",
          user,
          ids: idsAsesor,
          currentEmpresaId,
          cache: this.cache,
          soloConDuenio: true,
        });
      }
    } else if (scope === "empresa") {
      if (currentEmpresaId) {
        query.andWhere("insumo.id_empresa = :companyId", {
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
          alias: "insumo",
          user,
          ids,
          currentEmpresaId,
          cache: this.cache,
        });
      }
    }

    if (soloActivos) {
      query.andWhere("insumo.activo = true");
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.insumoRepository.findOne({
      where: { id, activo: true },
      relations: ["categoria"],
    });
  }

  async assertCategoriaExiste(idCategoria: number) {
    if (idCategoria === undefined || idCategoria === null) return;
    const categoria = await this.categoriaRepository.findOne({
      where: { id: idCategoria },
    });
    if (!categoria) {
      throw new BadRequestException(
        "La categoría de insumo indicada no existe",
      );
    }
  }

  async create(
    createInsumoDto: CreateInsumoDto,
    user: any,
    currentEmpresaId?: number,
  ) {
    const { alcance, uidAsesor, ...resto } = createInsumoDto;
    const scope = await resolverAlcanceCreate({
      alcance,
      uidAsesor,
      idEmpresa: createInsumoDto.idEmpresa,
      currentEmpresaId,
      user,
      cache: this.cache,
    });

    await this.assertCategoriaExiste(createInsumoDto.idCategoria);

    const nombre = normalizeNombre(createInsumoDto.nombre);
    await assertNombreUnico(
      this.insumoRepository,
      nombre,
      scope.idEmpresa,
      undefined,
      scope.uidPropietario,
    );

    try {
      const insumo = this.insumoRepository.create({
        ...resto,
        nombre,
        uidPropietario: scope.uidPropietario,
        idEmpresa: scope.idEmpresa,
      });
      return await this.insumoRepository.save(insumo);
    } catch (e) {
      translateUniqueViolation(e, "insumo");
    }
  }

  async update(id: number, updateInsumoDto: UpdateInsumoDto, user: any) {
    const insumo = await this.insumoRepository.findOne({ where: { id } });
    if (!insumo) {
      throw new NotFoundException("Insumo no encontrado");
    }

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    exigirEdicionAlcance(insumo, user, userEmpresas, "insumo");

    // Cambio de alcance (explícito) o movimiento legacy entre empresas.
    if (updateInsumoDto.alcance !== undefined) {
      const cambio = await resolverAlcanceCambio({
        alcance: updateInsumoDto.alcance,
        uidAsesor: updateInsumoDto.uidAsesor,
        idEmpresa: updateInsumoDto.idEmpresa,
        actual: {
          uidPropietario: insumo.uidPropietario,
          idEmpresa: insumo.idEmpresa,
        },
        user,
        cache: this.cache,
      });
      if (cambio) {
        await assertNombreUnico(
          this.insumoRepository,
          normalizeNombre(updateInsumoDto.nombre ?? insumo.nombre),
          cambio.idEmpresa,
          id,
          cambio.uidPropietario,
        );
        insumo.uidPropietario = cambio.uidPropietario;
        insumo.idEmpresa = cambio.idEmpresa;
      }
    } else if (
      updateInsumoDto.idEmpresa !== undefined &&
      updateInsumoDto.idEmpresa !== insumo.idEmpresa
    ) {
      if (insumo.uidPropietario != null) {
        throw new ForbiddenException(
          "Para cambiar el alcance de este insumo indique alcance",
        );
      }
      const nuevaEmpresa = updateInsumoDto.idEmpresa;
      if (!isAdmin) {
        if (nuevaEmpresa === null || !userEmpresas.includes(nuevaEmpresa)) {
          throw new ForbiddenException(
            "No tiene permisos para cambiar el alcance a esa empresa",
          );
        }
      }
      await assertNombreUnico(
        this.insumoRepository,
        normalizeNombre(updateInsumoDto.nombre ?? insumo.nombre),
        nuevaEmpresa,
        id,
        null,
      );
      insumo.idEmpresa = nuevaEmpresa;
    }

    if (updateInsumoDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateInsumoDto.nombre);
      if (nuevoNombre !== insumo.nombre) {
        await assertNombreUnico(
          this.insumoRepository,
          nuevoNombre,
          insumo.idEmpresa,
          id,
          insumo.uidPropietario,
        );
        insumo.nombre = nuevoNombre;
      }
    }

    if (updateInsumoDto.descripcion !== undefined) {
      insumo.descripcion = updateInsumoDto.descripcion;
    }

    if (updateInsumoDto.idCategoria !== undefined) {
      await this.assertCategoriaExiste(updateInsumoDto.idCategoria);
      insumo.idCategoria = updateInsumoDto.idCategoria;
    }

    if (updateInsumoDto.precioUnitario !== undefined) {
      insumo.precioUnitario = updateInsumoDto.precioUnitario;
    }

    if (updateInsumoDto.unidad !== undefined) {
      insumo.unidad = updateInsumoDto.unidad;
    }

    if (updateInsumoDto.activo !== undefined) {
      insumo.activo = updateInsumoDto.activo;
    }

    try {
      return await this.insumoRepository.save(insumo);
    } catch (e) {
      translateUniqueViolation(e, "insumo");
    }
  }
}
