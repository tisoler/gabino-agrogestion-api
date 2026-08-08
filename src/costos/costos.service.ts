import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Costo } from '../entities/costo.entity';
import { CreateCostoDto } from './dto/create-costo.dto';
import { UpdateCostoDto } from './dto/update-costo.dto';
import { Roles } from 'src/constantes';
import { assertNombreUnico, normalizeNombre, translateUniqueViolation } from '../utils/nombre';

@Injectable()
export class CostosService {
  constructor(
    @InjectRepository(Costo)
    private costoRepository: Repository<Costo>,
  ) { }

  findAll(user: any, all?: boolean, companyIds?: string, currentEmpresaId?: number, soloActivos?: boolean, scope?: string) {
    const query = this.costoRepository.createQueryBuilder('costo');

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    if (isAdmin) {
      if (all && !currentEmpresaId) {
        if (companyIds) {
          const ids = companyIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
          if (ids.length > 0) {
            query.andWhere('costo.id_empresa IN (:...ids)', { ids });
          }
        }
      } else if (currentEmpresaId) {
        query.andWhere('(costo.id_empresa IS NULL OR costo.id_empresa = :currentId)', { currentId: currentEmpresaId });
      } else {
        query.andWhere('costo.id_empresa IS NULL');
      }
    } else {
      if (scope === 'global') {
        query.andWhere('costo.id_empresa IS NULL');
      } else if (scope === 'empresa' && currentEmpresaId) {
        query.andWhere('costo.id_empresa = :companyId', { companyId: currentEmpresaId });
      } else if (all) {
        const ids: number[] = (user.idEmpresas || []).map((e: any) => Number(e)).filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length === 0) {
          query.andWhere('costo.id_empresa IS NULL');
        } else {
          query.andWhere('(costo.id_empresa IS NULL OR costo.id_empresa IN (:...ids))', { ids });
        }
      } else if (currentEmpresaId) {
        query.andWhere('costo.id_empresa = :currentId', { currentId: currentEmpresaId });
      } else {
        return [];
      }
    }

    if (soloActivos) {
      query.andWhere('costo.activo = true');
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.costoRepository.findOne({ where: { id, activo: true } });
  }

  async create(createCostoDto: CreateCostoDto, user: any, currentEmpresaId?: number) {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    let idEmpresa: number | null;
    if (isAdmin) {
      idEmpresa = createCostoDto.idEmpresa ?? null;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = createCostoDto.idEmpresa ?? currentEmpresaId;
    }

    const nombre = normalizeNombre(createCostoDto.nombre);
    await assertNombreUnico(this.costoRepository, nombre, idEmpresa);

    try {
      const costo = this.costoRepository.create({
        ...createCostoDto,
        nombre,
        idEmpresa,
      });
      return await this.costoRepository.save(costo);
    } catch (e) {
      translateUniqueViolation(e, 'costo');
    }
  }

  async update(id: number, updateCostoDto: UpdateCostoDto, user: any) {
    const costo = await this.costoRepository.findOne({ where: { id } });
    if (!costo) {
      throw new NotFoundException('Costo no encontrado');
    }

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isAdmin) {
      if (costo.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar un costo global');
      }
      if (!userEmpresas.includes(costo.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar un costo de otra empresa');
      }
    }

    if (updateCostoDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateCostoDto.nombre);
      if (nuevoNombre !== costo.nombre) {
        await assertNombreUnico(this.costoRepository, nuevoNombre, costo.idEmpresa, id);
        costo.nombre = nuevoNombre;
      }
    }

    if (updateCostoDto.descripcion !== undefined) {
      costo.descripcion = updateCostoDto.descripcion;
    }

    if (updateCostoDto.precioUnitario !== undefined) {
      costo.precioUnitario = updateCostoDto.precioUnitario;
    }

    if (updateCostoDto.activo !== undefined) {
      costo.activo = updateCostoDto.activo;
    }

    try {
      return await this.costoRepository.save(costo);
    } catch (e) {
      translateUniqueViolation(e, 'costo');
    }
  }
}
