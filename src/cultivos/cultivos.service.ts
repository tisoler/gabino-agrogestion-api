import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cultivo } from "../entities/cultivo.entity";
import { Variedad } from "../entities/variedad.entity";
import { CreateCultivoDto } from "./dto/create-cultivo.dto";
import { UpdateCultivoDto } from "./dto/update-cultivo.dto";
import { CreateVariedadDto } from "./dto/create-variedad.dto";
import { UpdateVariedadDto } from "./dto/update-variedad.dto";
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
export class CultivosService {
  constructor(
    @InjectRepository(Cultivo)
    private cultivoRepository: Repository<Cultivo>,
    @InjectRepository(Variedad)
    private variedadRepository: Repository<Variedad>,
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
    const query = this.cultivoRepository
      .createQueryBuilder("cultivo")
      .leftJoinAndSelect("cultivo.variedades", "variedad");

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    // Filtros unificados para todos los roles (sys-admin, asesor, productor):
    if (scope === "global") {
      query
        .andWhere("cultivo.id_empresa IS NULL")
        .andWhere("cultivo.uid_propietario IS NULL");
    } else if (scope === "asesor") {
      // Ítems de asesor (con dueño). Opcionalmente de un asesor puntual.
      query.andWhere("cultivo.uid_propietario IS NOT NULL");
      if (uidAsesor) {
        query.andWhere("cultivo.uid_propietario = :filtroAsesor", {
          filtroAsesor: uidAsesor,
        });
      }
      if (!isAdmin) {
        const idsAsesor: number[] = (user.idEmpresas || [])
          .map((e: any) => Number(e))
          .filter((n) => Number.isFinite(n) && n > 0);
        await aplicarVisibilidadAlcance({
          qb: query,
          alias: "cultivo",
          user,
          ids: idsAsesor,
          currentEmpresaId,
          cache: this.cache,
          soloConDuenio: true,
        });
      }
    } else if (scope === "empresa") {
      if (currentEmpresaId) {
        query.andWhere("cultivo.id_empresa = :companyId", {
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
          alias: "cultivo",
          user,
          ids,
          currentEmpresaId,
          cache: this.cache,
        });
      }
    }

    if (soloActivos) {
      query.andWhere("cultivo.activo = true");
    }

    return query.getMany();
  }

  async findOne(id: number) {
    const cultivo = await this.cultivoRepository.findOne({
      where: { id },
      relations: ["variedades"],
    });
    if (!cultivo) throw new NotFoundException("Cultivo no encontrado");
    return cultivo;
  }

  async create(
    createCultivoDto: CreateCultivoDto,
    user: any,
    currentEmpresaId?: number,
  ) {
    const { alcance, uidAsesor, ...resto } = createCultivoDto;
    const scope = await resolverAlcanceCreate({
      alcance,
      uidAsesor,
      idEmpresa: createCultivoDto.idEmpresa,
      currentEmpresaId,
      user,
      cache: this.cache,
    });

    const nombre = normalizeNombre(createCultivoDto.nombre);
    await assertNombreUnico(
      this.cultivoRepository,
      nombre,
      scope.idEmpresa,
      undefined,
      scope.uidPropietario,
    );

    try {
      const cultivo = this.cultivoRepository.create({
        ...resto,
        nombre,
        uidPropietario: scope.uidPropietario,
        idEmpresa: scope.idEmpresa,
      });
      return await this.cultivoRepository.save(cultivo);
    } catch (e) {
      translateUniqueViolation(e, "cultivo");
    }
  }

  async update(id: number, updateCultivoDto: UpdateCultivoDto, user: any) {
    const cultivo = await this.cultivoRepository.findOne({ where: { id } });
    if (!cultivo) throw new NotFoundException("Cultivo no encontrado");

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    exigirEdicionAlcance(cultivo, user, userEmpresas, "cultivo");

    // Empresa destino (alcance). Un no-admin sólo puede mover entre sus propias
    // empresas (nunca a global); con alcance explícito vale la regla general.
    if (updateCultivoDto.alcance !== undefined) {
      const cambio = await resolverAlcanceCambio({
        alcance: updateCultivoDto.alcance,
        uidAsesor: updateCultivoDto.uidAsesor,
        idEmpresa: updateCultivoDto.idEmpresa,
        actual: {
          uidPropietario: cultivo.uidPropietario,
          idEmpresa: cultivo.idEmpresa,
        },
        user,
        cache: this.cache,
      });
      if (cambio) {
        await assertNombreUnico(
          this.cultivoRepository,
          normalizeNombre(updateCultivoDto.nombre ?? cultivo.nombre),
          cambio.idEmpresa,
          id,
          cambio.uidPropietario,
        );
        cultivo.uidPropietario = cambio.uidPropietario;
        cultivo.idEmpresa = cambio.idEmpresa;
      }
    } else if (
      updateCultivoDto.idEmpresa !== undefined &&
      updateCultivoDto.idEmpresa !== cultivo.idEmpresa
    ) {
      if (cultivo.uidPropietario != null) {
        throw new ForbiddenException(
          "Para cambiar el alcance de este cultivo indique alcance",
        );
      }
      const nuevaEmpresa = updateCultivoDto.idEmpresa;
      if (!isAdmin) {
        if (nuevaEmpresa === null || !userEmpresas.includes(nuevaEmpresa)) {
          throw new ForbiddenException(
            "No tiene permisos para cambiar el alcance a esa empresa",
          );
        }
      }
      await assertNombreUnico(
        this.cultivoRepository,
        normalizeNombre(updateCultivoDto.nombre ?? cultivo.nombre),
        nuevaEmpresa,
        id,
        null,
      );
      cultivo.idEmpresa = nuevaEmpresa;
    }

    if (updateCultivoDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateCultivoDto.nombre);
      if (nuevoNombre !== cultivo.nombre) {
        await assertNombreUnico(
          this.cultivoRepository,
          nuevoNombre,
          cultivo.idEmpresa,
          id,
          cultivo.uidPropietario,
        );
        cultivo.nombre = nuevoNombre;
      }
    }

    if (updateCultivoDto.descripcion !== undefined) {
      cultivo.descripcion = updateCultivoDto.descripcion;
    }

    if (updateCultivoDto.tipoCosecha !== undefined) {
      cultivo.tipoCosecha = updateCultivoDto.tipoCosecha;
    }

    if (updateCultivoDto.activo !== undefined) {
      cultivo.activo = updateCultivoDto.activo;
    }

    try {
      return await this.cultivoRepository.save(cultivo);
    } catch (e) {
      translateUniqueViolation(e, "cultivo");
    }
  }

  async createVariedad(
    createVariedadDto: CreateVariedadDto,
    user: any,
    currentEmpresaId?: number,
  ) {
    const cultivo = await this.cultivoRepository.findOne({
      where: { id: createVariedadDto.idCultivo },
    });
    if (!cultivo) throw new NotFoundException("Cultivo no encontrado");

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    if (
      !isAdmin &&
      cultivo.idEmpresa !== null &&
      !userEmpresas.includes(cultivo.idEmpresa)
    ) {
      throw new ForbiddenException(
        "No tiene permisos para agregar una variedad a este cultivo",
      );
    }

    const idEmpresa = cultivo.idEmpresa ?? currentEmpresaId ?? null;

    // La variedad hereda el alcance del cultivo padre (incluido el dueño
    // asesor): siempre comparten scope.
    const variedad = this.variedadRepository.create({
      ...createVariedadDto,
      idEmpresa,
      uidPropietario: cultivo.uidPropietario ?? null,
    });
    return this.variedadRepository.save(variedad);
  }

  async updateVariedad(
    id: number,
    updateVariedadDto: UpdateVariedadDto,
    user: any,
  ) {
    const variedad = await this.variedadRepository.findOne({ where: { id } });
    if (!variedad) throw new NotFoundException("Variedad no encontrada");

    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    exigirEdicionAlcance(variedad, user, userEmpresas, "variedad");

    // La variedad no cambia de alcance ni de cultivo (hereda el del padre).
    const resto: Partial<UpdateVariedadDto> = { ...updateVariedadDto };
    delete resto.idEmpresa;
    delete resto.idCultivo;
    Object.assign(variedad, resto);
    return this.variedadRepository.save(variedad);
  }
}
