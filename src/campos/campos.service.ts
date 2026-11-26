import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { Campo } from "../entities/campo.entity";
import { CreateCampoDto } from "./dto/create-campo.dto";
import { normalizeNombre } from "../utils/nombre";

@Injectable()
export class CamposService {
  constructor(
    @InjectRepository(Campo)
    private campoRepository: Repository<Campo>,
  ) {}

  findAll() {
    return this.campoRepository.find({ order: { nombre: "ASC" } });
  }

  async findOne(id: number) {
    const campo = await this.campoRepository.findOne({ where: { id } });
    if (!campo) throw new NotFoundException("Campo no encontrado");
    return campo;
  }

  private async assertNombreUnico(
    nombre: string,
    idEmpresa: number | null,
    excludeId?: number,
  ) {
    const lower = nombre.trim().toLowerCase();
    if (!lower) return;

    const qb = this.campoRepository
      .createQueryBuilder("c")
      .where("LOWER(c.nombre) = :lower", { lower })
      .andWhere("c.activo = true");
    // Unicidad scoped a productor: el mismo nombre vale en otro productor.
    if (idEmpresa === null || idEmpresa === undefined) {
      qb.andWhere("c.id_empresa IS NULL");
    } else {
      qb.andWhere("c.id_empresa = :idEmpresa", { idEmpresa });
    }
    if (excludeId !== undefined) {
      qb.andWhere("c.id <> :excludeId", { excludeId });
    }

    const conflict = await qb.getOne();
    if (conflict) {
      throw new BadRequestException(
        `Ya existe un campo con el nombre "${nombre}" en este productor.`,
      );
    }
  }

  async create(createCampoDto: CreateCampoDto) {
    const nombre = normalizeNombre(createCampoDto.nombre);
    await this.assertNombreUnico(nombre, createCampoDto.idEmpresa ?? null);

    try {
      const campo = this.campoRepository.create({ ...createCampoDto, nombre });
      return await this.campoRepository.save(campo);
    } catch (e) {
      // Red de seguridad ante carreras (índice uq_campo_empresa_nombre).
      if (e instanceof QueryFailedError && (e as any).code === "23505") {
        throw new BadRequestException(
          `Ya existe un campo con el nombre "${nombre}" en este productor.`,
        );
      }
      throw e;
    }
  }
}
