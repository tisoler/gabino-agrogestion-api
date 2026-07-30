import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Costo } from '../entities/costo.entity';
import { CreateCostoDto } from './dto/create-costo.dto';
import { UpdateCostoDto } from './dto/update-costo.dto';
import { Roles } from 'src/constantes';

@Injectable()
export class CostosService {
  constructor(
    @InjectRepository(Costo)
    private costoRepository: Repository<Costo>,
  ) { }

  findAll(user: any, all?: boolean, companyIds?: string, currentEmpresaId?: number) {
    const query = this.costoRepository.createQueryBuilder('costo');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    if (isSysAdmin) {
      if (all) {
        if (companyIds) {
          const ids = companyIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
          if (ids.length > 0) {
            query.andWhere('costo.id_empresa IN (:...ids)', { ids });
          }
        }
      } else {
        query.andWhere('costo.id_empresa IS NULL');
      }
    } else {
      if (!currentEmpresaId) {
        return [];
      }
      query.andWhere('(costo.id_empresa = :currentId OR costo.id_empresa IS NULL)', { currentId: currentEmpresaId });
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.costoRepository.findOne({ where: { id, activo: true } });
  }

  create(createCostoDto: CreateCostoDto, user: any, currentEmpresaId?: number) {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    let idEmpresa: number | null;
    if (isSysAdmin) {
      idEmpresa = createCostoDto.idEmpresa ?? null;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = createCostoDto.idEmpresa ?? currentEmpresaId;
    }

    const costo = this.costoRepository.create({
      ...createCostoDto,
      idEmpresa,
    });
    return this.costoRepository.save(costo);
  }

  async update(id: number, updateCostoDto: UpdateCostoDto, user: any) {
    const costo = await this.costoRepository.findOne({ where: { id } });
    if (!costo) {
      throw new NotFoundException('Costo no encontrado');
    }

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isSysAdmin) {
      if (costo.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar un costo global');
      }
      if (!userEmpresas.includes(costo.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar un costo de otra empresa');
      }
    }

    Object.assign(costo, updateCostoDto);
    return this.costoRepository.save(costo);
  }
}
