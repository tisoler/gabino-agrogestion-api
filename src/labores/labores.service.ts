import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Labor } from '../entities/labor.entity';
import { CreateLaborDto } from './dto/create-labor.dto';
import { UpdateLaborDto } from './dto/update-labor.dto';
import { Roles } from 'src/constantes';

@Injectable()
export class LaboresService {
  constructor(
    @InjectRepository(Labor)
    private laborRepository: Repository<Labor>,
  ) { }

  findAll(user: any, all?: boolean, companyIds?: string, currentEmpresaId?: number) {
    const query = this.laborRepository.createQueryBuilder('labor');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    if (isSysAdmin) {
      if (all) {
        if (companyIds) {
          const ids = companyIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
          if (ids.length > 0) {
            query.andWhere('labor.id_empresa IN (:...ids)', { ids });
          }
        }
      } else {
        query.andWhere('labor.id_empresa IS NULL');
      }
    } else {
      if (!currentEmpresaId) {
        return [];
      }
      query.andWhere('(labor.id_empresa = :currentId OR labor.id_empresa IS NULL)', { currentId: currentEmpresaId });
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.laborRepository.findOne({ where: { id, activo: true } });
  }

  create(createLaborDto: CreateLaborDto, user: any, currentEmpresaId?: number) {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    let idEmpresa: number | null;
    if (isSysAdmin) {
      idEmpresa = createLaborDto.idEmpresa ?? null;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = createLaborDto.idEmpresa ?? currentEmpresaId;
    }

    const labor = this.laborRepository.create({
      ...createLaborDto,
      idEmpresa,
    });
    return this.laborRepository.save(labor);
  }

  async update(id: number, updateLaborDto: UpdateLaborDto, user: any) {
    const labor = await this.laborRepository.findOne({ where: { id } });
    if (!labor) {
      throw new NotFoundException('Labor no encontrada');
    }

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isSysAdmin) {
      if (labor.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar una labor global');
      }
      if (!userEmpresas.includes(labor.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar una labor de otra empresa');
      }
    }

    Object.assign(labor, updateLaborDto);
    return this.laborRepository.save(labor);
  }
}
