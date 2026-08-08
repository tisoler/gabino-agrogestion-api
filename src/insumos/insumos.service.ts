import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insumo } from '../entities/insumo.entity';
import { CategoriaInsumo } from '../entities/categoria-insumo.entity';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { Roles } from 'src/constantes';
import { assertNombreUnico, normalizeNombre, translateUniqueViolation } from '../utils/nombre';

@Injectable()
export class InsumosService {
  constructor(
    @InjectRepository(Insumo)
    private insumoRepository: Repository<Insumo>,
    @InjectRepository(CategoriaInsumo)
    private categoriaRepository: Repository<CategoriaInsumo>,
  ) { }

  findAll(user: any, all?: boolean, companyIds?: string, currentEmpresaId?: number, soloActivos?: boolean, scope?: string) {
    const query = this.insumoRepository.createQueryBuilder('insumo')
      .leftJoinAndSelect('insumo.categoria', 'categoria');

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    // Filtros unificados para todos los roles (sys-admin, asesor-admin, asesor, productor):
    if (scope === 'global') {
      query.andWhere('insumo.id_empresa IS NULL');
    } else if (scope === 'empresa') {
      if (currentEmpresaId) {
        query.andWhere('insumo.id_empresa = :companyId', { companyId: currentEmpresaId });
      } else {
        return [];
      }
    } else {
      if (!isAdmin) {
        const ids: number[] = (user.idEmpresas || []).map((e: any) => Number(e)).filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length === 0) {
          query.andWhere('insumo.id_empresa IS NULL');
        } else {
          query.andWhere('(insumo.id_empresa IS NULL OR insumo.id_empresa IN (:...ids))', { ids });
        }
      }
    }

    if (soloActivos) {
      query.andWhere('insumo.activo = true');
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.insumoRepository.findOne({
      where: { id, activo: true },
      relations: ['categoria'],
    });
  }

  async assertCategoriaExiste(idCategoria: number) {
    if (idCategoria === undefined || idCategoria === null) return;
    const categoria = await this.categoriaRepository.findOne({ where: { id: idCategoria } });
    if (!categoria) {
      throw new BadRequestException('La categoría de insumo indicada no existe');
    }
  }

  async create(createInsumoDto: CreateInsumoDto, user: any, currentEmpresaId?: number) {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    let idEmpresa: number | null;
    if (isAdmin) {
      idEmpresa = createInsumoDto.idEmpresa ?? null;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = createInsumoDto.idEmpresa ?? currentEmpresaId;
    }

    await this.assertCategoriaExiste(createInsumoDto.idCategoria);

    const nombre = normalizeNombre(createInsumoDto.nombre);
    await assertNombreUnico(this.insumoRepository, nombre, idEmpresa);

    try {
      const insumo = this.insumoRepository.create({
        ...createInsumoDto,
        nombre,
        idEmpresa,
      });
      return await this.insumoRepository.save(insumo);
    } catch (e) {
      translateUniqueViolation(e, 'insumo');
    }
  }

  async update(id: number, updateInsumoDto: UpdateInsumoDto, user: any) {
    const insumo = await this.insumoRepository.findOne({ where: { id } });
    if (!insumo) {
      throw new NotFoundException('Insumo no encontrado');
    }

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isAdmin) {
      if (insumo.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar un insumo global');
      }
      if (!userEmpresas.includes(insumo.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar un insumo de otra empresa');
      }
    }

    if (updateInsumoDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateInsumoDto.nombre);
      if (nuevoNombre !== insumo.nombre) {
        await assertNombreUnico(this.insumoRepository, nuevoNombre, insumo.idEmpresa, id);
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

    if (updateInsumoDto.activo !== undefined) {
      insumo.activo = updateInsumoDto.activo;
    }

    try {
      return await this.insumoRepository.save(insumo);
    } catch (e) {
      translateUniqueViolation(e, 'insumo');
    }
  }
}
