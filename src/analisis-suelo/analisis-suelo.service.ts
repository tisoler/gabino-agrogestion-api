import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnalisisSuelo } from "../entities/analisis-suelo.entity";
import { AnalisisSueloDetalle } from "../entities/analisis-suelo-detalle.entity";
import { Lote } from "../entities/lote.entity";
import { Roles } from "../constantes";
import { CreateAnalisisSueloDto } from "./dto/create-analisis-suelo.dto";
import {
  SueloExtraccionService,
  type ExtraccionSuelo,
} from "./suelo-extraccion.service";

@Injectable()
export class AnalisisSueloService {
  constructor(
    @InjectRepository(AnalisisSuelo)
    private analisisRepo: Repository<AnalisisSuelo>,
    @InjectRepository(AnalisisSueloDetalle)
    private detalleRepo: Repository<AnalisisSueloDetalle>,
    @InjectRepository(Lote) private loteRepo: Repository<Lote>,
    private extraccion: SueloExtraccionService,
  ) {}

  /** Catálogo de parámetros (para agregar filas manuales en el preview). */
  parametros() {
    return this.extraccion.catalogo();
  }

  /**
   * Extrae los datos de un informe (PDF o imagen) sin guardar nada: el
   * archivo se procesa en un temporal y se borra. El FE lo muestra como
   * preview para aceptar o ajustar antes de guardar.
   */
  async extraer(
    idLote: number,
    user: any,
    archivo: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ): Promise<ExtraccionSuelo> {
    await this.loteOrThrow(idLote, user);
    if (!archivo || archivo.buffer.length === 0) {
      throw new BadRequestException("Adjuntá el PDF o la imagen del informe.");
    }
    try {
      return await this.extraccion.extraer(archivo.buffer, archivo.mimetype);
    } catch (e) {
      if (e instanceof Error) throw new BadRequestException(e.message);
      throw e;
    }
  }

  async findAll(idLote: number, user: any): Promise<AnalisisSuelo[]> {
    await this.loteOrThrow(idLote, user);
    return this.analisisRepo
      .createQueryBuilder("a")
      .leftJoinAndSelect("a.detalles", "d")
      .where("a.id_lote = :idLote", { idLote })
      .andWhere("a.activo = true")
      .orderBy("a.fecha_emision", "DESC", "NULLS LAST")
      .addOrderBy("a.fecha_recepcion", "DESC", "NULLS LAST")
      .addOrderBy("a.id", "DESC")
      .getMany();
  }

  async create(
    idLote: number,
    dto: CreateAnalisisSueloDto,
    user: any,
  ): Promise<AnalisisSuelo> {
    await this.loteOrThrow(idLote, user);
    const detalles = (dto.detalles ?? []).map((d) => ({
      parametro: d.parametro?.trim(),
      etiqueta: (d.etiqueta ?? d.parametro ?? "").trim() || d.parametro?.trim(),
      valorNum: d.valorNum ?? null,
      valorTexto: d.valorTexto?.trim() ? d.valorTexto.trim() : null,
      unidad: d.unidad?.trim() ? d.unidad.trim() : null,
      metodo: d.metodo?.trim() ? d.metodo.trim() : null,
    }));
    const validos = detalles.filter(
      (d) =>
        d.parametro &&
        (d.valorNum !== null || (d.valorTexto !== null && d.valorTexto !== "")),
    );
    if (validos.length === 0) {
      throw new BadRequestException(
        "El análisis necesita al menos una determinación con valor.",
      );
    }
    const analisis = this.analisisRepo.create({
      idLote,
      laboratorio: dto.laboratorio?.trim() || null,
      nroAnalisis: dto.nroAnalisis?.trim() || null,
      fechaRecepcion: dto.fechaRecepcion || null,
      fechaEmision: dto.fechaEmision || null,
      profundidad: dto.profundidad?.trim() || null,
      muestra: dto.muestra?.trim() || null,
      activo: true,
      detalles: validos.map((d) => this.detalleRepo.create(d)),
    });
    return this.analisisRepo.save(analisis);
  }

  async remove(id: number, user: any): Promise<{ ok: boolean }> {
    const analisis = await this.analisisRepo.findOne({
      where: { id },
      relations: { lote: true },
    });
    if (!analisis || !analisis.activo) {
      throw new NotFoundException("Análisis no encontrado");
    }
    await this.assertLoteAcceso(analisis.lote ?? null, analisis.idLote, user);
    analisis.activo = false;
    await this.analisisRepo.save(analisis);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Helpers de scope (mismo patrón que lotes: sys-admin todo, resto sus empresas)
  // ---------------------------------------------------------------------------
  private async loteOrThrow(idLote: number, user: any): Promise<Lote> {
    const lote = await this.loteRepo.findOne({ where: { id: idLote } });
    if (!lote) throw new NotFoundException("Lote no encontrado");
    await this.assertLoteAcceso(lote, idLote, user);
    return lote;
  }

  private async assertLoteAcceso(
    lote: Lote | null,
    idLote: number,
    user: any,
  ): Promise<void> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    if (isAdmin) return;
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );
    const loteReal =
      lote ?? (await this.loteRepo.findOne({ where: { id: idLote } }));
    if (!loteReal || !userEmpresas.includes(loteReal.idEmpresa)) {
      throw new ForbiddenException("No tiene permisos para ver este lote");
    }
  }
}
