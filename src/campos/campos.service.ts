import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Campo } from "../entities/campo.entity";
import { CreateCampoDto } from "./dto/create-campo.dto";
import { normalizeNombre, translateUniqueViolation } from "../utils/nombre";

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

  private async assertNombreUnico(nombre: string) {
    const lower = nombre.trim().toLowerCase();
    if (!lower) return;

    const conflict = await this.campoRepository
      .createQueryBuilder("c")
      .where("LOWER(c.nombre) = :lower", { lower })
      .andWhere("c.activo = true")
      .getOne();
    if (conflict) {
      throw new BadRequestException(
        `Ya existe un campo con el nombre "${nombre}".`,
      );
    }
  }

  async create(createCampoDto: CreateCampoDto) {
    const nombre = normalizeNombre(createCampoDto.nombre);
    await this.assertNombreUnico(nombre);

    try {
      const campo = this.campoRepository.create({ ...createCampoDto, nombre });
      return await this.campoRepository.save(campo);
    } catch (e) {
      translateUniqueViolation(e, "campo");
    }
  }
}
