import { BadRequestException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';

/**
 * Normaliza un nombre para almacenamiento: primera letra en mayúscula y el
 * resto en minúscula (espacios al borde se eliminan). Vacíos pasan tal cual.
 */
export function normalizeNombre(s: string): string {
  const t = (s ?? '').trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/**
 * Verifica que no exista otro item con el mismo nombre en el scope solicitado.
 *
 * Reglas de unicidad (case-insensitive, sólo ítems activos):
 *  - `idEmpresa = null`  → creando un global: bloquea si ya existe OTRO global
 *    con ese nombre. Empresas NO bloquean al global.
 *  - `idEmpresa = N`     → creando en la empresa N: bloquea si existe un
 *    global con ese nombre o un item de la misma empresa N. Otras empresas
 *    NO bloquean.
 *  - `excludeId` permite excluir el item actual (para updates).
 */
export async function assertNombreUnico<T extends { id: number; idEmpresa: number | null; nombre: string }>(
  repo: Repository<T>,
  nombre: string,
  idEmpresa: number | null,
  excludeId?: number,
): Promise<void> {
  const lower = nombre.trim().toLowerCase();
  if (!lower) return;

  const qb = repo
    .createQueryBuilder('x')
    .where('LOWER(x.nombre) = :lower', { lower })
    .andWhere('x.activo = true');

  if (idEmpresa === null) {
    // Globales: solo choca con otro global
    qb.andWhere('x.id_empresa IS NULL');
  } else {
    // Empresa: choca con global o con la misma empresa
    qb.andWhere('(x.id_empresa IS NULL OR x.id_empresa = :idEmpresa)', { idEmpresa });
  }

  if (excludeId !== undefined) {
    qb.andWhere('x.id <> :excludeId', { excludeId });
  }

  const conflict = await qb.getOne();
  if (conflict) {
    const scope = idEmpresa === null
      ? 'global'
      : 'global o en esta empresa';
    throw new BadRequestException(
      `Ya existe un ítem con el nombre "${nombre}" (${scope}).`,
    );
  }
}

/**
 * Si la operación de guardado lanzó una violación de índice único (carrera),
 * la convierte en un BadRequest con un mensaje claro.
 */
export function translateUniqueViolation(err: unknown, label: string): never {
  if (err instanceof QueryFailedError && (err as any).code === '23505') {
    throw new BadRequestException(
      `Ya existe un ${label} con ese nombre en este ámbito (global o la misma empresa).`,
    );
  }
  throw err as Error;
}
