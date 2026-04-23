import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from '../entities/empresa.entity';
import { Roles } from 'src/constantes';

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa)
    private empresaRepository: Repository<Empresa>,
  ) { }

  findAll(user: any): Promise<Empresa[]> {
    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);

    if (isSysAdmin) {
      return this.empresaRepository.find({
        where: { activo: true },
        order: { nombre: 'ASC' }
      });
    }

    // Para asesores u otros, filtrar por su lista de empresas permitidas
    // Si no es sys-admin, asumimos que solo puede ver las que tiene asignadas
    const allowedIds = user.idEmpresas || [];
    if (user.idEmpresa && !allowedIds.includes(user.idEmpresa)) {
      allowedIds.push(user.idEmpresa);
    }

    if (allowedIds.length === 0) return Promise.resolve([]);

    return this.empresaRepository.createQueryBuilder('empresa')
      .where('empresa.id IN (:...ids)', { ids: allowedIds })
      .andWhere('empresa.activo = :activo', { activo: true })
      .orderBy('empresa.nombre', 'ASC')
      .getMany();
  }

  findOne(id: number): Promise<Empresa | null> {
    if (!id) return null;
    return this.empresaRepository.findOne({ where: { id } });
  }
}
