import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import * as admin from "firebase-admin";
import { MensajeMasivo } from "../entities/mensaje-masivo.entity";
import { Campania } from "../entities/campania.entity";
import { Lote } from "../entities/lote.entity";
import { Cultivo } from "../entities/cultivo.entity";
import { Empresa } from "../entities/empresa.entity";
import { FirestoreCacheService } from "../cache/firestore-cache.service";
import { Roles } from "../constantes";
import { CreateMensajeMasivoDto } from "./dto/create-mensaje-masivo.dto";

/**
 * Destinatario resuelto para la campaña de WhatsApp: usuario de Firestore
 * (productor o asesor) con celular, vinculado a una empresa que tiene
 * producción del cultivo elegido en el período indicado.
 */
export interface DestinatarioMensaje {
  uid: string;
  nombreUsuario: string;
  email: string | null;
  celular: string;
  empresas: string[];
}

/**
 * Período de campaña actual: misma regla que `periodosCampania()[0]` del FE
 * (año corriente → "yy/(yy+1)", ej: 2026 → "26/27").
 */
const periodoActual = (): string => {
  const y = new Date().getFullYear();
  return `${String(y % 100).padStart(2, "0")}/${String((y + 1) % 100).padStart(2, "0")}`;
};

@Injectable()
export class MensajesMasivosService {
  constructor(
    @InjectRepository(MensajeMasivo)
    private mensajeRepo: Repository<MensajeMasivo>,
    @InjectRepository(Campania) private campaniaRepo: Repository<Campania>,
    @InjectRepository(Lote) private loteRepo: Repository<Lote>,
    @InjectRepository(Cultivo) private cultivoRepo: Repository<Cultivo>,
    @InjectRepository(Empresa) private empresaRepo: Repository<Empresa>,
    private cache: FirestoreCacheService,
  ) {}

  // ---------------------------------------------------------------------------
  // Historial
  // ---------------------------------------------------------------------------
  /**
   * Alcance del historial: sys-admin y asesor-admin ven todos los registros;
   * el asesor sólo los que lo tienen como emisor.
   */
  findAll(user: any) {
    const where = this.esAdmin(user) ? {} : { idUsuarioEmisor: user.id };
    return this.mensajeRepo.find({
      where,
      relations: { cultivo: true },
      order: { fecha: "DESC", id: "DESC" },
    });
  }

  async findOne(id: number, user: any) {
    const mensaje = await this.mensajeRepo.findOne({
      where: { id },
      relations: { cultivo: true },
    });
    if (!mensaje) throw new NotFoundException("Mensaje masivo no encontrado");
    // El asesor sólo puede ver el detalle de sus propios envíos.
    if (!this.esAdmin(user) && mensaje.idUsuarioEmisor !== user.id) {
      throw new ForbiddenException("No tiene permisos para ver este mensaje");
    }
    return mensaje;
  }

  // ---------------------------------------------------------------------------
  // Destinatarios
  // ---------------------------------------------------------------------------
  /**
   * Resuelve los destinatarios para un cultivo: empresas con producción de
   * ese cultivo en el período indicado → usuarios de Firestore (productor o
   * asesor) vinculados a esas empresas que tengan celular cargado.
   *
   * Alcance: admins ven todas las empresas; el resto sólo las de su
   * `idEmpresas` (mismo patrón que los accesos de campañas).
   */
  async destinatarios(
    idCultivo: number,
    user: any,
    campaniaRaw?: string,
  ): Promise<DestinatarioMensaje[]> {
    const campania = this.periodoValido(campaniaRaw);

    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    // Producciones activas del cultivo en el período → lotes → empresas.
    const producciones = await this.campaniaRepo.find({
      where: { campania, idCultivo, activo: true },
      select: ["idLote"],
    });
    if (producciones.length === 0) return [];

    const lotes = await this.loteRepo.find({
      where: { id: In(producciones.map((p) => p.idLote)), activo: true },
      select: ["idEmpresa"],
    });
    let empresaIds = [...new Set(lotes.map((l) => l.idEmpresa))];

    if (!isAdmin) {
      empresaIds = empresaIds.filter((id) => userEmpresas.includes(id));
    }
    if (empresaIds.length === 0) return [];

    const empresas = await this.empresaRepo.find({
      where: { id: In(empresaIds) },
    });
    const nombreEmpresa = new Map(
      empresas.map((e) => [e.id, e.nombre] as [number, string]),
    );
    const empresaSet = new Set(empresaIds);

    // Usuarios de Firestore: productor/asesor de esas empresas, con celular.
    const usuarios = await this.cache.getOrLoadUsuarios();
    const resultado: DestinatarioMensaje[] = [];
    const vistos = new Set<string>();
    for (const u of usuarios) {
      if (vistos.has(u.uid)) continue;
      if (!u.celular) continue;
      const esProductorOAsesor =
        u.roles.includes(Roles.PRODUCTOR) || u.roles.includes(Roles.ASESOR);
      if (!esProductorOAsesor) continue;
      const propias = u.idEmpresas.filter((id) => empresaSet.has(id));
      if (propias.length === 0) continue;
      vistos.add(u.uid);
      resultado.push({
        uid: u.uid,
        nombreUsuario: u.nombreUsuario || u.email || u.uid,
        email: u.email,
        celular: u.celular,
        empresas: propias
          .map((id) => nombreEmpresa.get(id))
          .filter((n): n is string => Boolean(n)),
      });
    }

    return resultado.sort((a, b) =>
      a.nombreUsuario.localeCompare(b.nombreUsuario, "es"),
    );
  }

  // ---------------------------------------------------------------------------
  // Creación
  // ---------------------------------------------------------------------------
  async create(dto: CreateMensajeMasivoDto, user: any) {
    const mensaje = dto.mensaje.trim();
    if (!mensaje) {
      throw new BadRequestException("El mensaje no puede estar vacío");
    }
    const campania = this.periodoValido(dto.campania);

    await this.assertCultivo(dto.idCultivo, user);

    // Re-resolver destinatarios en el servidor: se ignoran uids sin celular,
    // fuera de alcance o que ya no califican para el cultivo/período.
    const todos = await this.destinatarios(dto.idCultivo, user, campania);
    const pedidos = new Set(dto.uids);
    const destinatarios = todos.filter((d) => pedidos.has(d.uid));
    if (destinatarios.length === 0) {
      throw new BadRequestException(
        "Ninguno de los destinatarios indicados es válido (sin celular o fuera de alcance)",
      );
    }

    const registro = this.mensajeRepo.create({
      mensaje,
      fecha: new Date(),
      idUsuarioEmisor: user.id,
      emailEmisor: user.email ?? null,
      nombreEmisor: await this.nombreDeUsuario(user.id, user.email),
      campania,
      idCultivo: dto.idCultivo,
      telefonosDestino: destinatarios.map((d) => d.celular),
      emailsDestino: destinatarios
        .map((d) => d.email)
        .filter((e): e is string => Boolean(e)),
    });
    const guardado = await this.mensajeRepo.save(registro);

    return {
      ...guardado,
      destinatarios: destinatarios.map((d) => ({
        uid: d.uid,
        nombreUsuario: d.nombreUsuario,
        celular: d.celular,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private esAdmin(user: any): boolean {
    return Boolean(
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN),
    );
  }

  private periodoValido(campaniaRaw?: string): string {
    if (!campaniaRaw) return periodoActual();
    const campania = campaniaRaw.trim();
    if (!/^\d{2}\/\d{2}$/.test(campania)) {
      throw new BadRequestException(
        "El período de campaña tiene formato inválido (ej: 25/26)",
      );
    }
    return campania;
  }

  /**
   * El cultivo debe existir y ser visible: los cultivos de empresa sólo los
   * pueden usar admins o usuarios de esa empresa (igual que en campañas).
   */
  private async assertCultivo(idCultivo: number, user: any) {
    const cultivo = await this.cultivoRepo.findOne({
      where: { id: idCultivo },
    });
    if (!cultivo)
      throw new BadRequestException("El cultivo indicado no existe");
    if (cultivo.idEmpresa !== null) {
      const isAdmin =
        user.roles?.includes(Roles.SYS_ADMIN) ||
        user.roles?.includes(Roles.ASESOR_ADMIN);
      const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
        Number(e),
      );
      if (!isAdmin && !userEmpresas.includes(cultivo.idEmpresa)) {
        throw new ForbiddenException(
          "No tiene permisos para usar este cultivo",
        );
      }
    }
  }

  /**
   * Nombre del emisor desde su doc de Firestore (con fallback al email).
   * No usa el cache de usuarios porque el emisor puede ser sys-admin, que
   * está excluido de ese listado.
   */
  private async nombreDeUsuario(
    uid: string,
    emailFallback?: string,
  ): Promise<string | null> {
    try {
      const doc = await admin.firestore().collection("usuarios").doc(uid).get();
      const data = doc.data();
      const nombre = data?.nombre ?? data?.nombreUsuario;
      if (typeof nombre === "string" && nombre.trim() !== "") {
        return nombre.trim();
      }
    } catch (e) {
      console.warn(
        "[mensajes-masivos] No se pudo leer el nombre del emisor:",
        e,
      );
    }
    return emailFallback ?? null;
  }
}
