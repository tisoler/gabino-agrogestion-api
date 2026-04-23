import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cultivo } from '../entities/cultivo.entity';
import { Variedad } from '../entities/variedad.entity';
import { CreateCultivoDto } from './dto/create-cultivo.dto';
import { UpdateCultivoDto } from './dto/update-cultivo.dto';
import { CreateVariedadDto } from './dto/create-variedad.dto';
import { UpdateVariedadDto } from './dto/update-variedad.dto';
import { Roles } from 'src/constantes';

@Injectable()
export class CultivosService {
  constructor(
    @InjectRepository(Cultivo)
    private cultivoRepository: Repository<Cultivo>,
    @InjectRepository(Variedad)
    private variedadRepository: Repository<Variedad>,
  ) { }

  findAll(user: any, all?: boolean, companyIds?: string, currentEmpresaId?: number) {
    const query = this.cultivoRepository.createQueryBuilder('cultivo')
      .leftJoinAndSelect('cultivo.variedades', 'variedad');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    if (isSysAdmin) {
      if (all) {
        if (companyIds) {
          const ids = companyIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
          if (ids.length > 0) {
            query.andWhere('cultivo.id_empresa IN (:...ids)', { ids });
          }
        }
      } else {
        query.andWhere('cultivo.id_empresa IS NULL');
      }
    } else {
      const currentId = currentEmpresaId || user.idEmpresa;
      query.andWhere('(cultivo.id_empresa = :currentId OR cultivo.id_empresa IS NULL)', { currentId });
    }

    return query.getMany();
  }

  async findOne(id: number) {
    const cultivo = await this.cultivoRepository.findOne({ 
      where: { id },
      relations: ['variedades']
    });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');
    return cultivo;
  }

  create(createCultivoDto: CreateCultivoDto, user: any) {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const idEmpresa = isSysAdmin ? (createCultivoDto.idEmpresa || null) : (createCultivoDto.idEmpresa || user.idEmpresa);

    const cultivo = this.cultivoRepository.create({
      ...createCultivoDto,
      idEmpresa
    });
    return this.cultivoRepository.save(cultivo);
  }

  async update(id: number, updateCultivoDto: UpdateCultivoDto, user: any) {
    const cultivo = await this.cultivoRepository.findOne({ where: { id } });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    if (!isSysAdmin) {
      if (cultivo.idEmpresa === null) throw new ForbiddenException('No tiene permisos para editar un cultivo global');
      const authorizedEmpresas = user.idEmpresas?.map(id => Number(id)) || [];
      if (!authorizedEmpresas.includes(cultivo.idEmpresa) && Number(user.idEmpresa) !== cultivo.idEmpresa) {
        throw new ForbiddenException('No tiene permisos para editar un cultivo de otra empresa');
      }
    }

    Object.assign(cultivo, updateCultivoDto);
    return this.cultivoRepository.save(cultivo);
  }

  // Variety Methods
  async createVariedad(createVariedadDto: CreateVariedadDto, user: any) {
    const cultivo = await this.cultivoRepository.findOne({ where: { id: createVariedadDto.idCultivo } });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const idEmpresa = cultivo.idEmpresa; // Variedad hereda idEmpresa del cultivo

    const variedad = this.variedadRepository.create({
      ...createVariedadDto,
      idEmpresa
    });
    return this.variedadRepository.save(variedad);
  }

  async updateVariedad(id: number, updateVariedadDto: UpdateVariedadDto, user: any) {
    const variedad = await this.variedadRepository.findOne({ where: { id } });
    if (!variedad) throw new NotFoundException('Variedad no encontrada');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    if (!isSysAdmin) {
      if (variedad.idEmpresa === null) throw new ForbiddenException('No tiene permisos para editar una variedad global');
      const authorizedEmpresas = user.idEmpresas?.map(id => Number(id)) || [];
      if (!authorizedEmpresas.includes(variedad.idEmpresa) && Number(user.idEmpresa) !== variedad.idEmpresa) {
        throw new ForbiddenException('No tiene permisos para editar una variedad de otra empresa');
      }
    }

    Object.assign(variedad, updateVariedadDto);
    return this.variedadRepository.save(variedad);
  }
}
