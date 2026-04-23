import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
        // If all is true, no filters means everything active
      } else {
        // Default for sys-admin: see only global ones
        query.andWhere('insumo.id_empresa IS NULL');
      }
    } else {
      // Para asesores y otros: solo la empresa seleccionada (proviene de x-empresa-id) + globales
      const currentId = currentEmpresaId || user.idEmpresa;
      query.andWhere('(insumo.id_empresa = :currentId OR insumo.id_empresa IS NULL)', { currentId });
    }

    return query.getMany();
  }

  findOne(id: number) {
    return this.insumoRepository.findOne({ where: { id, activo: true } });
  }

  create(createInsumoDto: CreateInsumoDto, user: any) {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    // Si es sys-admin crea globales, si no, crea de la empresa seleccionada (o para la empresa por defecto del usuario)
    const idEmpresa = isSysAdmin ? (createInsumoDto.idEmpresa || null) : (createInsumoDto.idEmpresa || user.idEmpresa);

    const insumo = this.insumoRepository.create({
      ...createInsumoDto,
      idEmpresa
    });
    return this.insumoRepository.save(insumo);
  }

  async update(id: number, updateInsumoDto: UpdateInsumoDto, user: any) {
    const insumo = await this.insumoRepository.findOne({ where: { id } });
    if (!insumo) {
      throw new NotFoundException('Insumo no encontrado');
    }

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    if (!isSysAdmin) {
      if (insumo.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar un insumo global');
      }
      if (
        !user.idEmpresas?.map((id: string | number) => isNaN(Number(id)) ? -1 : Number(id)).includes(insumo.idEmpresa)
        && parseInt(user.idEmpresa ?? -1) !== insumo.idEmpresa
      ) {
        throw new ForbiddenException('No tiene permisos para editar un insumo de otra empresa');
      }
    }

    // Actualizar campos
    Object.assign(insumo, updateInsumoDto);

    return this.insumoRepository.save(insumo);
  }
}
