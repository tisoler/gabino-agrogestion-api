import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { SelectQueryBuilder } from "typeorm";
import { Roles } from "src/constantes";
import { FirestoreCacheService } from "../cache/firestore-cache.service";

/**
 * Triple alcance de ítems de catálogo (labor/insumo/costo/cultivo/variedad):
 *  - global:  uid NULL + empresa NULL (sys-admin).
 *  - asesor:  uid seteado + empresa NULL (todas sus empresas).
 *  - empresa: uid NULL + empresa seteada (esa empresa).
 * Ambos seteados a la vez no es válido.
 */
export type Alcance = "global" | "asesor" | "empresa";

export interface AlcanceResuelto {
  uidPropietario: string | null;
  idEmpresa: number | null;
}

/** UIDs de asesores vinculados a una empresa (por su `idEmpresas`). */
export async function uidsAsesoresDeEmpresa(
  cache: FirestoreCacheService,
  idEmpresa: number,
): Promise<string[]> {
  const usuarios = await cache.getOrLoadUsuarios();
  return usuarios
    .filter(
      (u) => u.roles.includes(Roles.ASESOR) && u.idEmpresas.includes(idEmpresa),
    )
    .map((u) => u.uid);
}

/** ¿El uid corresponde a un asesor que asesora la empresa indicada? */
export async function asesoraEmpresa(
  cache: FirestoreCacheService,
  uid: string | null | undefined,
  idEmpresa: number,
): Promise<boolean> {
  if (!uid) return false;
  const auth = await cache.getOrLoadAuth(uid).catch(() => null);
  if (!auth || !auth.roles.includes(Roles.ASESOR)) return false;
  return auth.idEmpresas.includes(idEmpresa);
}

/**
 * ¿Puede el usuario usar en la empresa indicada un ítem con dueño asesor?
 * (propio, sys-admin, o el dueño asesora esa empresa — caso del productor
 * que usa inline los ítems del asesor, o asesores que comparten productor).
 */
export async function puedeUsarItemAsesorEn(
  cache: FirestoreCacheService,
  uidPropietario: string | null | undefined,
  user: any,
  idEmpresa: number,
): Promise<boolean> {
  if (!uidPropietario) return true;
  if (esSys(user)) return true;
  if (uidPropietario === user?.id) return true;
  return asesoraEmpresa(cache, uidPropietario, idEmpresa);
}

/**
 * ¿El uid asesora alguna de las empresas indicadas? (chequeos con alcance de
 * usuario, sin lote concreto — espejo de los asserts por empresa del usuario).
 */
export async function asesoraAlgunaEmpresa(
  cache: FirestoreCacheService,
  uid: string | null | undefined,
  idEmpresas: number[],
): Promise<boolean> {
  if (!uid) return false;
  const auth = await cache.getOrLoadAuth(uid).catch(() => null);
  if (!auth || !auth.roles.includes(Roles.ASESOR)) return false;
  return auth.idEmpresas.some((e) => idEmpresas.includes(e));
}

/** Valida que un UID corresponda a un usuario con rol asesor. */
export async function assertEsAsesor(
  cache: FirestoreCacheService,
  uid: string,
): Promise<void> {
  const auth = await cache.getOrLoadAuth(uid).catch(() => null);
  if (!auth || !auth.roles.includes(Roles.ASESOR)) {
    throw new BadRequestException("El UID no corresponde a un asesor");
  }
}

function esSys(user: any): boolean {
  return !!user?.roles?.includes(Roles.SYS_ADMIN);
}

function esAsesor(user: any): boolean {
  return !!user?.roles?.includes(Roles.ASESOR);
}

/**
 * Resuelve (uidPropietario, idEmpresa) para crear un ítem.
 * Sin `alcance` se comporta como antes (alcance empresa con la empresa del
 * DTO o la actual), así los flujos inline no cambian.
 */
export async function resolverAlcanceCreate(opts: {
  alcance?: Alcance | null;
  uidAsesor?: string | null;
  idEmpresa?: number | null;
  currentEmpresaId?: number;
  user: any;
  cache: FirestoreCacheService;
}): Promise<AlcanceResuelto> {
  const { user, cache } = opts;
  const alcance: Alcance = opts.alcance ?? "empresa";
  if (alcance !== "global" && alcance !== "asesor" && alcance !== "empresa") {
    throw new BadRequestException("Alcance inválido");
  }

  if (alcance === "global") {
    if (!esSys(user)) {
      throw new ForbiddenException("Solo sys-admin puede crear ítems globales");
    }
    return { uidPropietario: null, idEmpresa: null };
  }

  if (alcance === "asesor") {
    if (esAsesor(user)) {
      return { uidPropietario: user.id, idEmpresa: null };
    }
    if (esSys(user)) {
      if (!opts.uidAsesor) {
        throw new BadRequestException(
          "Indicar uidAsesor para alcance de asesor",
        );
      }
      await assertEsAsesor(cache, opts.uidAsesor);
      return { uidPropietario: opts.uidAsesor, idEmpresa: null };
    }
    throw new ForbiddenException("Solo asesores pueden crear ítems de asesor");
  }

  // empresa: comportamiento histórico (DTO o empresa actual).
  const idEmpresa = opts.idEmpresa ?? opts.currentEmpresaId ?? null;
  if (!esSys(user) && idEmpresa == null) {
    throw new BadRequestException(
      "El usuario no tiene una empresa actual seleccionada",
    );
  }
  return { uidPropietario: null, idEmpresa };
}

/**
 * Resuelve un cambio de alcance en update. Devuelve null si no hay cambio.
 * `actual` es el alcance vigente del ítem.
 */
export async function resolverAlcanceCambio(opts: {
  alcance?: Alcance | null;
  uidAsesor?: string | null;
  /** undefined = no provisto (sólo tiene efecto con `alcance: "empresa"`). */
  idEmpresa?: number | null;
  actual: AlcanceResuelto;
  user: any;
  cache: FirestoreCacheService;
}): Promise<AlcanceResuelto | null> {
  const { user, cache, actual } = opts;
  if (opts.alcance == null) return null;
  const alcance = opts.alcance;
  if (alcance !== "global" && alcance !== "asesor" && alcance !== "empresa") {
    throw new BadRequestException("Alcance inválido");
  }

  if (alcance === "global") {
    if (!esSys(user)) {
      throw new ForbiddenException("Solo sys-admin puede mover a global");
    }
    return { uidPropietario: null, idEmpresa: null };
  }

  if (alcance === "asesor") {
    let uid: string;
    if (esAsesor(user)) {
      uid = user.id;
    } else if (esSys(user)) {
      if (!opts.uidAsesor) {
        throw new BadRequestException(
          "Indicar uidAsesor para alcance de asesor",
        );
      }
      await assertEsAsesor(cache, opts.uidAsesor);
      uid = opts.uidAsesor;
    } else {
      throw new ForbiddenException(
        "Solo asesores pueden mover a alcance de asesor",
      );
    }
    return { uidPropietario: uid, idEmpresa: null };
  }

  // empresa: destino explícito o el vigente.
  const destino = opts.idEmpresa ?? actual.idEmpresa;
  if (!esSys(user)) {
    const propias: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );
    if (destino == null || !propias.includes(destino)) {
      throw new ForbiddenException(
        "No tiene permisos para cambiar el alcance a esa empresa",
      );
    }
  }
  return { uidPropietario: null, idEmpresa: destino };
}

/**
 * Chequeo de origen para editar un ítem (complementa los chequeos por
 * empresa de cada servicio): un no-sys-admin sólo toca ítems globales...
 * nunca; los de asesor sólo si son propios; los de empresa como antes.
 */
export function exigirEdicionAlcance(
  item: { uidPropietario: string | null; idEmpresa: number | null },
  user: any,
  userEmpresas: number[],
  label: string,
): void {
  const sys = esSys(user);
  if (sys) return;
  if (item.uidPropietario != null) {
    if (item.uidPropietario !== user.id) {
      throw new ForbiddenException(
        `No tiene permisos para editar este ${label} de otro asesor`,
      );
    }
    return;
  }
  if (item.idEmpresa === null) {
    throw new ForbiddenException(
      `No tiene permisos para editar un ${label} global`,
    );
  }
  if (!userEmpresas.includes(item.idEmpresa)) {
    throw new ForbiddenException(
      `No tiene permisos para editar un ${label} de otra empresa`,
    );
  }
}

/**
 * Agrega la condición de visibilidad por alcance al listado (para no-admin;
 * el admin ve todo). Cubre: globales, empresa propia, propios del asesor y
 * —con empresa de contexto— los del asesor que asesora esa empresa.
 * Con `soloConDuenio` (filtro "De asesor") excluye globales y de empresa.
 */
export async function aplicarVisibilidadAlcance(opts: {
  qb: SelectQueryBuilder<any>;
  alias: string;
  user: any;
  ids: number[];
  currentEmpresaId?: number;
  cache: FirestoreCacheService;
  soloConDuenio?: boolean;
}): Promise<void> {
  const { qb, alias, user, ids, currentEmpresaId, cache } = opts;
  const soloConDuenio = opts.soloConDuenio ?? false;
  const uid: string | null =
    typeof user?.id === "string" && user.id ? user.id : null;
  const conds: string[] = [];
  const params: Record<string, unknown> = {};
  if (!soloConDuenio) {
    conds.push(
      `(${alias}.id_empresa IS NULL AND ${alias}.uid_propietario IS NULL)`,
    );
    if (ids.length > 0) {
      conds.push(`${alias}.id_empresa IN (:...alcanceIds)`);
      params.alcanceIds = ids;
    }
  }
  if (uid) {
    conds.push(`${alias}.uid_propietario = :alcanceUid`);
    params.alcanceUid = uid;
  }
  if (currentEmpresaId) {
    const asesores = await uidsAsesoresDeEmpresa(cache, currentEmpresaId).catch(
      () => [],
    );
    const otros = asesores.filter((a) => a !== uid);
    if (otros.length > 0) {
      conds.push(`${alias}.uid_propietario IN (:...alcanceAsesores)`);
      params.alcanceAsesores = otros;
    }
  }
  if (conds.length === 0) {
    qb.andWhere("1 = 0");
    return;
  }
  qb.andWhere(`(${conds.join(" OR ")})`, params);
}
