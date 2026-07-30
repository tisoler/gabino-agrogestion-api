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
      if (!currentEmpresaId) {
        return [];
      }
      query.andWhere('(cultivo.id_empresa = :currentId OR cultivo.id_empresa IS NULL)', { currentId: currentEmpresaId });
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

  create(createCultivoDto: CreateCultivoDto, user: any, currentEmpresaId?: number) {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    let idEmpresa: number | null;
    if (isSysAdmin) {
      idEmpresa = createCultivoDto.idEmpresa ?? null;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = createCultivoDto.idEmpresa ?? currentEmpresaId;
    }

    const cultivo = this.cultivoRepository.create({
      ...createCultivoDto,
      idEmpresa,
    });
    return this.cultivoRepository.save(cultivo);
  }

  async update(id: number, updateCultivoDto: UpdateCultivoDto, user: any) {
    const cultivo = await this.cultivoRepository.findOne({ where: { id } });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isSysAdmin) {
      if (cultivo.idEmpresa === null) {
        throw new ForbiddenException('No tiene permisos para editar un cultivo global');
      }
      if (!userEmpresas.includes(cultivo.idEmpresa)) {
        throw new ForbiddenException('No tiene permisos para editar un cultivo de otra empresa');
      }
    }

    Object.assign(cultivo, updateCultivoDto);
    return this.cultivoRepository.save(cultivo);
  }

  async createVariedad(createVariedadDto: CreateVariedadDto, user: any, currentEmpresaId?: number) {
    const cultivo = await this.cultivoRepository.findOne({ where: { id: createVariedadDto.idCultivo } });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isSysAdmin && cultivo.idEmpresa !== null && !userEmpresas.includes(cultivo.idEmpresa)) {
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

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isSysAdmin) {
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
