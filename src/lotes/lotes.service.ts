import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lote } from '../entities/lote.entity';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { Roles } from 'src/constantes';

@Injectable()
export class LotesService {
  constructor(
    @InjectRepository(Lote)
    private loteRepository: Repository<Lote>,
  ) {}

  /**
   * Lista lotes visibles para el usuario.
   *
   *  - sys-admin: ve todos los lotes (sin filtro de empresa). Si llega
   *    `currentEmpresaId`, filtra a esa empresa concreta.
   *  - asesor / productor: ve los lotes de las empresas en su `idEmpresas`.
   *    Si llega `currentEmpresaId` y está en su `idEmpresas`, filtra a esa.
   *    Si llega una empresa que NO está en su `idEmpresas`, devuelve [].
   *
   * No hay lotes "globales" (la columna `id_empresa` es NOT NULL), por lo
   * que no hay rama para "ver todos sin filtro de empresa" fuera de
   * sys-admin.
   */
  findAll(user: any, currentEmpresaId?: number) {
    const query = this.loteRepository.createQueryBuilder('lote');
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (currentEmpresaId) {
      // Filtro por empresa específica
      if (!isSysAdmin && !userEmpresas.includes(currentEmpresaId)) {
        return [];
      }
      query.andWhere('lote.id_empresa = :currentId', { currentId: currentEmpresaId });
      return query.getMany();
    }

    // Sin filtro: sys-admin ve todo; el resto ve los de sus idEmpresas
    if (isSysAdmin) {
      return query.getMany();
    }

    if (userEmpresas.length === 0) {
      return [];
    }

    return query
      .andWhere('lote.id_empresa IN (:...ids)', { ids: userEmpresas })
      .getMany();
  }

  async findOne(id: number) {
    const lote = await this.loteRepository.findOne({ where: { id } });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    return lote;
  }

  async create(createLoteDto: CreateLoteDto, user: any, currentEmpresaId?: number) {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    let idEmpresa: number;
    if (isSysAdmin) {
      if (!createLoteDto.idEmpresa) {
        throw new BadRequestException('Debe indicar la empresa destino del lote');
      }
      idEmpresa = createLoteDto.idEmpresa;
    } else {
      if (!currentEmpresaId) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      idEmpresa = currentEmpresaId;
    }

    const lote = this.loteRepository.create({
      descripcion: createLoteDto.descripcion,
      idUsuario: createLoteDto.idUsuario,
      lat: createLoteDto.lat,
      long: createLoteDto.long,
      idEmpresa,
    });
    return this.loteRepository.save(lote);
  }

  async update(id: number, updateLoteDto: UpdateLoteDto, user: any) {
    const lote = await this.loteRepository.findOne({ where: { id } });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isSysAdmin && !userEmpresas.includes(lote.idEmpresa)) {
      throw new ForbiddenException('No tiene permisos para editar un lote de otra empresa');
    }

    if (updateLoteDto.idEmpresa && updateLoteDto.idEmpresa !== lote.idEmpresa) {
      if (!isSysAdmin) {
        throw new ForbiddenException('Solo el sys-admin puede cambiar la empresa de un lote');
      }
    }

    Object.assign(lote, updateLoteDto);
    return this.loteRepository.save(lote);
  }
}
