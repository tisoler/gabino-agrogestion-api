import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Aseguradora } from "../entities/aseguradora.entity";
import { CreateAseguradoraDto } from "./dto/create-aseguradora.dto";
import { UpdateAseguradoraDto } from "./dto/update-aseguradora.dto";
import { Roles } from "src/constantes";
import { translateUniqueViolation } from "../utils/nombre";

@Injectable()
export class AseguradorasService {
  constructor(
    @InjectRepository(Aseguradora)
    private aseguradoraRepo: Repository<Aseguradora>,
  ) {}

  findAll(soloActivas = false) {
    return this.aseguradoraRepo.find({
      where: soloActivas ? { activo: true } : undefined,
      order: { nombre: "ASC" },
    });
  }

  async findOne(id: number) {
    const aseguradora = await this.aseguradoraRepo.findOne({ where: { id } });
    if (!aseguradora)
      throw new NotFoundException("Empresa de seguros no encontrada");
    return aseguradora;
  }

  private assertCanManage(user: any) {
    const roles: string[] = user.roles || [];
    if (!roles.includes(Roles.SYS_ADMIN)) {
      throw new ForbiddenException(
        "Solo sys-admin puede administrar empresas de seguros",
      );
    }
  }

  async create(dto: CreateAseguradoraDto, user: any) {
    this.assertCanManage(user);
    const nombre = (dto.nombre ?? "").trim();
    if (!nombre) throw new BadRequestException("El nombre es obligatorio");
    try {
      return await this.aseguradoraRepo.save(
        this.aseguradoraRepo.create({ nombre }),
      );
    } catch (e) {
      translateUniqueViolation(e, "empresa de seguros");
    }
  }

  async update(id: number, dto: UpdateAseguradoraDto, user: any) {
    const aseguradora = await this.findOne(id);
    this.assertCanManage(user);
    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      if (!nombre) throw new BadRequestException("El nombre es obligatorio");
      aseguradora.nombre = nombre;
    }
    if (dto.activo !== undefined) aseguradora.activo = dto.activo;
    try {
      return await this.aseguradoraRepo.save(aseguradora);
    } catch (e) {
      translateUniqueViolation(e, "empresa de seguros");
    }
  }
}
