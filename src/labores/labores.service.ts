import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
      const currentId = currentEmpresaId || user.idEmpresa;
      query.andWhere('(labor.id_empresa = :currentId OR labor.id_empresa IS NULL)', { currentId });
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.laborRepository.findOne({ where: { id, activo: true } });
  }

  create(createLaborDto: CreateLaborDto, user: any) {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const idEmpresa = isSysAdmin ? (createLaborDto.idEmpresa || null) : (createLaborDto.idEmpresa || user.idEmpresa);

    const labor = this.laborRepository.create({
      ...createLaborDto,
      idEmpresa
    });
    return this.laborRepository.save(labor);
  }

  async update(id: number, updateLaborDto: UpdateLaborDto, user: any) {
    const labor = await this.laborRepository.findOne({ where: { id } });
    if (!labor) {
      throw new NotFoundException('Labor no encontrada');
    }

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    if (!isSysAdmin) {
      if (labor.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar una labor global');
      }
      if (
        !user.idEmpresas?.map((id: string | number) => isNaN(Number(id)) ? -1 : Number(id)).includes(labor.idEmpresa)
        && parseInt(user.idEmpresa ?? -1) !== labor.idEmpresa
      ) {
        throw new ForbiddenException('No tiene permisos para editar una labor de otra empresa');
      }
    }

    Object.assign(labor, updateLaborDto);
    return this.laborRepository.save(labor);
  }
}
