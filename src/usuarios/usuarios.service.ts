import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as admin from "firebase-admin";
import { Empresa } from "../entities/empresa.entity";
import { Lote } from "../entities/lote.entity";
import { Roles, ID_ROL_PREDETERMINADO } from "src/constantes";
import type { UsuarioBasico } from "../empresas/empresas.service";
import { FirestoreCacheService } from "../cache/firestore-cache.service";

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Empresa)
    private empresaRepository: Repository<Empresa>,
    @InjectRepository(Lote)
    private loteRepository: Repository<Lote>,
    private cache: FirestoreCacheService,
  ) {}

  /**
   * Asocia/desasocia empresas a un usuario, actualizando su array `idEmpresas`
   * en Firestore.
   *
   * Reglas:
   *  - sys-admin: puede tocar cualquier empresa.
   *  - asesor: sólo empresas que estén en su propio `idEmpresas`.
   *  - productor: no autorizado (lo bloquea el controller con @Roles).
   *  - Las empresas indicadas deben existir en la BD.
   *  - `add` y `remove` se aplican de forma idempotente (sin duplicados).
   *
   * Tolerante al schema de Firestore: si el documento actual tiene
   * `idEmpresas` como array, escalar o faltante, se reescribe como array
   * de números.
   */
  async updateEmpresas(
    uid: string,
    add: number[],
    remove: number[],
    user: any,
  ): Promise<UsuarioBasico> {
    if (!uid || typeof uid !== "string") {
      throw new BadRequestException("uid es requerido");
    }
    if (add.length === 0 && remove.length === 0) {
      throw new BadRequestException(
        "Debe especificar al menos una empresa para agregar o quitar",
      );
    }

    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    // Un usuario no-admin (asesor) no puede desasociarse a sí mismo de una empresa.
    if (!isAdmin && uid === user.id && remove.length > 0) {
      throw new ForbiddenException(
        "No puede desasociarse a sí mismo de una empresa",
      );
    }

    // Para no-sys-admin, las empresas a tocar deben estar en su idEmpresas
    if (!isAdmin) {
      for (const empresaId of [...add, ...remove]) {
        if (!userEmpresas.includes(empresaId)) {
          throw new ForbiddenException(
            `No tiene permisos para modificar la asociación con la empresa ${empresaId}`,
          );
        }
      }
    }

    // Verificar que cada empresa existe en la BD
    for (const empresaId of [...add, ...remove]) {
      const empresa = await this.empresaRepository.findOne({
        where: { id: empresaId },
      });
      if (!empresa) {
        throw new NotFoundException(`Empresa ${empresaId} no encontrada`);
      }
    }

    // No se puede desasociar a un usuario de una empresa si tiene lotes
    // cargados en esa empresa como dueño.
    if (remove.length > 0) {
      const lotesConDueno = await this.loteRepository
        .createQueryBuilder("lote")
        .where("lote.id_usuario = :uid", { uid })
        .andWhere("lote.id_empresa IN (:...ids)", { ids: remove })
        .getCount();
      if (lotesConDueno > 0) {
        throw new BadRequestException(
          "No se puede desasociar al usuario: tiene lotes cargados en la empresa como dueño",
        );
      }
    }

    // Leer el documento actual
    const db = admin.firestore();
    const userRef = db.collection("usuarios").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new NotFoundException(`Usuario ${uid} no encontrado en Firestore`);
    }
    const currentData = userDoc.data() || {};

    // Un sys-admin nunca puede ser asociado a una empresa.
    if (add.length > 0) {
      const rolesSnap = await db.collection("roles").get();
      const roleById = new Map<string, string>();
      for (const doc of rolesSnap.docs) {
        const nombre = doc.data()?.nombre;
        if (typeof nombre === "string" && nombre) {
          roleById.set(doc.id, nombre);
        }
      }
      const targetRoles = this.resolveRoles(currentData, roleById);
      if (targetRoles.includes(Roles.SYS_ADMIN)) {
        throw new ForbiddenException(
          "Los sys-admins no pueden ser asociados a una empresa",
        );
      }
    }

    // Resolver idEmpresas actual (array, escalar o faltante) → number[]
    const idEmpresas = this.resolveCurrentIdEmpresas(currentData);

    // Aplicar cambios idempotentes
    const next = new Set(idEmpresas);
    for (const e of add) next.add(e);
    for (const e of remove) next.delete(e);
    const newIdEmpresas = Array.from(next).sort((a, b) => a - b);

    await userRef.update({ idEmpresas: newIdEmpresas });

    // La asociación cambió: invalidar cache de auth del usuario y el listado.
    this.cache.invalidateUser(uid);
    this.cache.invalidateAll();

    // Enriquecer respuesta con datos de Firebase Auth
    const authMap = await this.fetchAuthRecords([uid]);
    const auth = authMap.get(uid);

    return {
      uid,
      email: auth?.email ?? currentData?.email ?? null,
      nombreUsuario:
        currentData?.nombre ??
        currentData?.nombreUsuario ??
        auth?.displayName ??
        auth?.email ??
        uid,
      photoURL:
        currentData?.picture ?? currentData?.photoURL ?? auth?.photoURL ?? null,
      roles: Array.isArray(currentData?.roles)
        ? currentData.roles.map((r: any) => String(r))
        : [],
      idEmpresas: newIdEmpresas,
    };
  }

  /**
   * Bootstrap de usuarios nuevos (signup): crea el documento `usuarios/{uid}`
   * en Firestore si no existe, con el rol por defecto y el nombre de la cuenta
   * (displayName o email de Firebase Auth). No pisa documentos existentes.
   *
   * El BE usa el admin SDK (ignora las reglas de seguridad del cliente) y
   * después invalida los caches para que el usuario nuevo aparezca de inmediato.
   */
  async bootstrapUsuario(user: any): Promise<{ ok: boolean }> {
    const uid = user.id;
    const db = admin.firestore();
    const ref = db.collection("usuarios").doc(uid);

    const snap = await ref.get();
    if (!snap.exists) {
      let nombre = typeof user.email === "string" ? user.email : "";
      try {
        const record = await admin.auth().getUser(uid);
        nombre = record.displayName || record.email || nombre;
      } catch {
        /* sin acceso a Auth: seguimos con el email */
      }
      await ref.set({ idRol: ID_ROL_PREDETERMINADO, nombre });
    }

    this.cache.invalidateUser(uid);
    this.cache.invalidateAll();
    return { ok: true };
  }

  /**
   * Lista todos los usuarios de Firestore aptos para ser asociados a una
   * empresa. A diferencia de `findAllWithUsers` (que sólo devuelve usuarios
   * con intersección en `idEmpresas`), aquí se listan TODOS los usuarios,
   * sin importar si tienen empresas asignadas.
   *
   * Reglas:
   *  - Se excluyen sys-admins (no pueden pertenecer a una empresa).
   *  - Se excluyen usuarios sin rol resuelto.
   *  - Un mismo usuario puede pertenecer a varias empresas: aparecerá como
   *    candidato para cualquiera que no lo tenga ya asociado (eso lo filtra
   *    el FE por empresa).
   *
   * El listado se sirve desde el cache (FirestoreCacheService).
   */
  async findCandidatos(): Promise<UsuarioBasico[]> {
    return this.cache.getOrLoadUsuarios();
  }

  private resolveRoles(data: any, roleById: Map<string, string>): string[] {
    if (Array.isArray(data?.roles) && data.roles.length > 0) {
      return data.roles.map((r: any) => String(r));
    }
    if (data?.rol) {
      return [String(data.rol)];
    }
    // `idRol` puede venir como número (ej. 4) aunque los doc-ids de la
    // colección "roles" son strings; normalizar antes de buscar en el Map.
    const idRolKey = data?.idRol != null ? String(data.idRol) : null;
    if (idRolKey && roleById.has(idRolKey)) {
      return [roleById.get(idRolKey)!];
    }
    return [];
  }

  private resolveCurrentIdEmpresas(data: any): number[] {
    const raw = data?.idEmpresas;
    if (Array.isArray(raw)) {
      return raw
        .map((e: any) => Number(e))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    }
    if (raw !== undefined && raw !== null) {
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? [n] : [];
    }
    return [];
  }

  private async fetchAuthRecords(
    uids: string[],
  ): Promise<Map<string, admin.auth.UserRecord>> {
    const result = new Map<string, admin.auth.UserRecord>();
    if (uids.length === 0) return result;
    try {
      const res = await admin.auth().getUsers(uids.map((uid) => ({ uid })));
      for (const rec of res.users) result.set(rec.uid, rec);
    } catch (err) {
      console.warn("[usuarios] No se pudo enriquecer con Firebase Auth:", err);
    }
    return result;
  }
}
