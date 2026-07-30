import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insumo } from '../entities/insumo.entity';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { Roles } from 'src/constantes';

@Injectable()
export class InsumosService {
  constructor(
    @InjectRepository(Insumo)
    private insumoRepository: Repository<Insumo>,
  ) { }

  findAll(user: any, all?: boolean, companyIds?: string, currentEmpresaId?: number) {
    const query = this.insumoRepository.createQueryBuilder('insumo');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    if (isSysAdmin) {
      if (all) {
        if (companyIds) {
          const ids = companyIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
          if (ids.length > 0) {
            query.andWhere('insumo.id_empresa IN (:...ids)', { ids });
          }
        }
      } else {
        query.andWhere('insumo.id_empresa IS NULL');
      }
    } else {
      if (!currentEmpresaId) {
        return [];
      }
      query.andWhere('(insumo.id_empresa = :currentId OR insumo.id_empresa IS NULL)', { currentId: currentEmpresaId });
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.insumoRepository.findOne({ where: { id, activo: true } });
  }

  create(createInsumoDto: CreateInsumoDto, user: any, currentEmpresaId?: number) {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    let idEmpresa: number | null;
    if (isSysAdmin) {
      idEmpresa = createInsumoDto.idEmpresa ?? null;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = createInsumoDto.idEmpresa ?? currentEmpresaId;
    }

    const insumo = this.insumoRepository.create({
      ...createInsumoDto,
      idEmpresa,
    });
    return this.insumoRepository.save(insumo);
  }

  async update(id: number, updateInsumoDto: UpdateInsumoDto, user: any) {
    const insumo = await this.insumoRepository.findOne({ where: { id } });
    if (!insumo) {
      throw new NotFoundException('Insumo no encontrado');
    }

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isSysAdmin) {
      if (insumo.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar un insumo global');
      }
      if (!userEmpresas.includes(insumo.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar un insumo de otra empresa');
      }
    }

    Object.assign(insumo, updateInsumoDto);
    return this.insumoRepository.save(insumo);
  }
}
