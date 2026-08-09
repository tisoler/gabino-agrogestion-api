import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cultivo } from '../entities/cultivo.entity';
import { Variedad } from '../entities/variedad.entity';
import { CreateCultivoDto } from './dto/create-cultivo.dto';
import { UpdateCultivoDto } from './dto/update-cultivo.dto';
import { CreateVariedadDto } from './dto/create-variedad.dto';
import { UpdateVariedadDto } from './dto/update-variedad.dto';
import { Roles } from 'src/constantes';
import { assertNombreUnico, normalizeNombre, translateUniqueViolation } from '../utils/nombre';

@Injectable()
export class CultivosService {
  constructor(
    @InjectRepository(Cultivo)
    private cultivoRepository: Repository<Cultivo>,
    @InjectRepository(Variedad)
    private variedadRepository: Repository<Variedad>,
  ) { }

  findAll(user: any, all?: boolean, companyIds?: string, currentEmpresaId?: number, soloActivos?: boolean, scope?: string) {
    const query = this.cultivoRepository.createQueryBuilder('cultivo')
      .leftJoinAndSelect('cultivo.variedades', 'variedad');

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    // Filtros unificados para todos los roles (sys-admin, asesor-admin, asesor, productor):
    if (scope === 'global') {
      query.andWhere('cultivo.id_empresa IS NULL');
    } else if (scope === 'empresa') {
      if (currentEmpresaId) {
        query.andWhere('cultivo.id_empresa = :companyId', { companyId: currentEmpresaId });
      } else {
        return [];
      }
    } else {
      if (!isAdmin) {
        const ids: number[] = (user.idEmpresas || []).map((e: any) => Number(e)).filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length === 0) {
          query.andWhere('cultivo.id_empresa IS NULL');
        } else {
          query.andWhere('(cultivo.id_empresa IS NULL OR cultivo.id_empresa IN (:...ids))', { ids });
        }
      }
    }

    if (soloActivos) {
      query.andWhere('cultivo.activo = true');
    }

    return query.getMany();
  }

  async findOne(id: number) {
    const cultivo = await this.cultivoRepository.findOne({
      where: { id },
      relations: ['variedades'],
    });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');
    return cultivo;
  }

  async create(createCultivoDto: CreateCultivoDto, user: any, currentEmpresaId?: number) {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    let idEmpresa: number | null;
    if (isAdmin) {
      idEmpresa = createCultivoDto.idEmpresa ?? null;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = createCultivoDto.idEmpresa ?? currentEmpresaId;
    }

    const nombre = normalizeNombre(createCultivoDto.nombre);
    await assertNombreUnico(this.cultivoRepository, nombre, idEmpresa);

    try {
      const cultivo = this.cultivoRepository.create({
        ...createCultivoDto,
        nombre,
        idEmpresa,
      });
      return await this.cultivoRepository.save(cultivo);
    } catch (e) {
      translateUniqueViolation(e, 'cultivo');
    }
  }

  async update(id: number, updateCultivoDto: UpdateCultivoDto, user: any) {
    const cultivo = await this.cultivoRepository.findOne({ where: { id } });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isAdmin) {
      if (cultivo.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar un cultivo global');
      }
      if (!userEmpresas.includes(cultivo.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar un cultivo de otra empresa');
      }
    }

    // Empresa destino (alcance). Un no-admin sólo puede mover entre sus propias
    // empresas (nunca a global).
    if (updateCultivoDto.idEmpresa !== undefined && updateCultivoDto.idEmpresa !== cultivo.idEmpresa) {
      const nuevaEmpresa = updateCultivoDto.idEmpresa;
      if (!isAdmin) {
        if (nuevaEmpresa === null || !userEmpresas.includes(nuevaEmpresa)) {
          throw new ForbiddenException('No tiene permisos para cambiar el alcance a esa empresa');
        }
      }
      await assertNombreUnico(
        this.cultivoRepository,
        normalizeNombre(updateCultivoDto.nombre ?? cultivo.nombre),
        nuevaEmpresa,
        id,
      );
      cultivo.idEmpresa = nuevaEmpresa;
    }

    if (updateCultivoDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateCultivoDto.nombre);
      if (nuevoNombre !== cultivo.nombre) {
        await assertNombreUnico(this.cultivoRepository, nuevoNombre, cultivo.idEmpresa, id);
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
      translateUniqueViolation(e, 'cultivo');
    }
  }

  async createVariedad(createVariedadDto: CreateVariedadDto, user: any, currentEmpresaId?: number) {
    const cultivo = await this.cultivoRepository.findOne({ where: { id: createVariedadDto.idCultivo } });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isAdmin && cultivo.idEmpresa !== null && !userEmpresas.includes(cultivo.idEmpresa)) {
      throw new ForbiddenException('No tiene permisos para agregar una variedad a este cultivo');
    }

    const idEmpresa = cultivo.idEmpresa ?? currentEmpresaId ?? null;

    const variedad = this.variedadRepository.create({
      ...createVariedadDto,
      idEmpresa,
    });
    return this.variedadRepository.save(variedad);
  }

  async updateVariedad(id: number, updateVariedadDto: UpdateVariedadDto, user: any) {
    const variedad = await this.variedadRepository.findOne({ where: { id } });
    if (!variedad) throw new NotFoundException('Variedad no encontrada');

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isAdmin) {
      if (variedad.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar una variedad global');
      }
      if (!userEmpresas.includes(variedad.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar una variedad de otra empresa');
      }
    }

    Object.assign(variedad, updateVariedadDto);
    return this.variedadRepository.save(variedad);
  }
}
