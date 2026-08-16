import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CategoriaInsumo } from "../entities/categoria-insumo.entity";
import { CreateCategoriaInsumoDto } from "./dto/create-categoria-insumo.dto";
import { UpdateCategoriaInsumoDto } from "./dto/update-categoria-insumo.dto";
import { Roles } from "src/constantes";
import { normalizeNombre, translateUniqueViolation } from "../utils/nombre";

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(CategoriaInsumo)
    private categoriaRepository: Repository<CategoriaInsumo>,
  ) {}

  findAll() {
    return this.categoriaRepository.find({ order: { nombre: "ASC" } });
  }

  async findOne(id: number) {
    const categoria = await this.categoriaRepository.findOne({ where: { id } });
    if (!categoria)
      throw new NotFoundException("Categoría de insumo no encontrada");
    return categoria;
  }

  private assertCanManage(user: any) {
    const roles: string[] = user.roles || [];
    const canManage =
      roles.includes(Roles.SYS_ADMIN) || roles.includes(Roles.ASESOR_ADMIN);
    if (!canManage) {
      throw new ForbiddenException(
        "Solo sys-admin o asesor-admin pueden crear o editar categorías de insumo",
      );
    }
  }

  private async assertNombreUnico(nombre: string, excludeId?: number) {
    const lower = nombre.trim().toLowerCase();
    if (!lower) return;

    const qb = this.categoriaRepository
      .createQueryBuilder("c")
      .where("LOWER(c.nombre) = :lower", { lower })
      .andWhere("c.activo = true");

    if (excludeId !== undefined) {
      qb.andWhere("c.id <> :excludeId", { excludeId });
    }

    const conflict = await qb.getOne();
    if (conflict) {
      throw new BadRequestException(
        `Ya existe una categoría de insumo con el nombre "${nombre}".`,
      );
    }
  }

  async create(createCategoriaInsumoDto: CreateCategoriaInsumoDto, user: any) {
    this.assertCanManage(user);

    const nombre = normalizeNombre(createCategoriaInsumoDto.nombre);
    await this.assertNombreUnico(nombre);

    try {
      const categoria = this.categoriaRepository.create({
        ...createCategoriaInsumoDto,
        nombre,
      });
      return await this.categoriaRepository.save(categoria);
    } catch (e) {
      translateUniqueViolation(e, "categoría de insumo");
    }
  }

  async update(
    id: number,
    updateCategoriaInsumoDto: UpdateCategoriaInsumoDto,
    user: any,
  ) {
    const categoria = await this.categoriaRepository.findOne({ where: { id } });
    if (!categoria)
      throw new NotFoundException("Categoría de insumo no encontrada");

    this.assertCanManage(user);

    if (updateCategoriaInsumoDto.nombre !== undefined) {
      const nuevoNombre = normalizeNombre(updateCategoriaInsumoDto.nombre);
      if (nuevoNombre !== categoria.nombre) {
        await this.assertNombreUnico(nuevoNombre, id);
        categoria.nombre = nuevoNombre;
      }
    }

    if (updateCategoriaInsumoDto.descripcion !== undefined) {
      categoria.descripcion = updateCategoriaInsumoDto.descripcion;
    }

    if (updateCategoriaInsumoDto.activo !== undefined) {
      categoria.activo = updateCategoriaInsumoDto.activo;
    }

    try {
      return await this.categoriaRepository.save(categoria);
    } catch (e) {
      translateUniqueViolation(e, "categoría de insumo");
    }
  }
}
