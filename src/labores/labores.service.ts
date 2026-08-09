import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Labor } from '../entities/labor.entity';
import { CreateLaborDto } from './dto/create-labor.dto';
import { UpdateLaborDto } from './dto/update-labor.dto';
import { Roles } from 'src/constantes';
import { assertNombreUnico, normalizeNombre, translateUniqueViolation } from '../utils/nombre';

@Injectable()
export class LaboresService {
  constructor(
    @InjectRepository(Labor)
    private laborRepository: Repository<Labor>,
  ) { }

  findAll(user: any, all?: boolean, companyIds?: string, currentEmpresaId?: number, soloActivos?: boolean, scope?: string) {
    const query = this.laborRepository.createQueryBuilder('labor');

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    // Filtros unificados para todos los roles (sys-admin, asesor-admin, asesor, productor):
    if (scope === 'global') {
      query.andWhere('labor.id_empresa IS NULL');
    } else if (scope === 'empresa') {
      if (currentEmpresaId) {
        query.andWhere('labor.id_empresa = :companyId', { companyId: currentEmpresaId });
      } else {
        return [];
      }
    } else {
      if (!isAdmin) {
        const ids: number[] = (user.idEmpresas || []).map((e: any) => Number(e)).filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length === 0) {
          query.andWhere('labor.id_empresa IS NULL');
        } else {
          query.andWhere('(labor.id_empresa IS NULL OR labor.id_empresa IN (:...ids))', { ids });
        }
      }
    }

    if (soloActivos) {
      query.andWhere('labor.activo = true');
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.laborRepository.findOne({ where: { id, activo: true } });
  }

  async create(createLaborDto: CreateLaborDto, user: any, currentEmpresaId?: number) {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    let idEmpresa: number | null;
    if (isAdmin) {
      idEmpresa = createLaborDto.idEmpresa ?? null;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = createLaborDto.idEmpresa ?? currentEmpresaId;
    }

    const nombre = normalizeNombre(createLaborDto.nombre);
    await assertNombreUnico(this.laborRepository, nombre, idEmpresa);

    try {
      const labor = this.laborRepository.create({
        ...createLaborDto,
        nombre,
        idEmpresa,
      });
      return await this.laborRepository.save(labor);
    } catch (e) {
      translateUniqueViolation(e, 'labor');
    }
  }

  async update(id: number, updateLaborDto: UpdateLaborDto, user: any) {
    const labor = await this.laborRepository.findOne({ where: { id } });
    if (!labor) {
      throw new NotFoundException('Labor no encontrada');
    }

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isAdmin) {
      if (labor.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar una labor global');
      }
      if (!userEmpresas.includes(labor.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar una labor de otra empresa');
      }
    }

    if (updateLaborDto.idEmpresa !== undefined && updateLaborDto.idEmpresa !== labor.idEmpresa) {
      const nuevaEmpresa = updateLaborDto.idEmpresa;
      if (!isAdmin) {
        if (nuevaEmpresa === null || !userEmpresas.includes(nuevaEmpresa)) {
          throw new ForbiddenException('No tiene permisos para cambiar el alcance a esa empresa');
        }
      }
      await assertNombreUnico(
        this.laborRepository,
        normalizeNombre(updateLaborDto.nombre ?? labor.nombre),
        nuevaEmpresa,
        id,
      );
      labor.idEmpresa = nuevaEmpresa;
    }

    if (updateLaborDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateLaborDto.nombre);
      if (nuevoNombre !== labor.nombre) {
        await assertNombreUnico(this.laborRepository, nuevoNombre, labor.idEmpresa, id);
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
      translateUniqueViolation(e, 'labor');
    }
  }
}
