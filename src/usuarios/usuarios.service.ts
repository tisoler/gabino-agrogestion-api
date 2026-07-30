import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { Empresa } from '../entities/empresa.entity';
import { Roles } from 'src/constantes';
import type { UsuarioBasico } from '../empresas/empresas.service';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Empresa)
    private empresaRepository: Repository<Empresa>,
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
    if (!uid || typeof uid !== 'string') {
      throw new BadRequestException('uid es requerido');
    }
    if (add.length === 0 && remove.length === 0) {
      throw new BadRequestException('Debe especificar al menos una empresa para agregar o quitar');
    }

    const isSysAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    // Para no-sys-admin, las empresas a tocar deben estar en su idEmpresas
    if (!isSysAdmin) {
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
      const empresa = await this.empresaRepository.findOne({ where: { id: empresaId } });
      if (!empresa) {
        throw new NotFoundException(`Empresa ${empresaId} no encontrada`);
      }
    }

    // Leer el documento actual
    const db = admin.firestore();
    const userRef = db.collection('usuarios').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new NotFoundException(`Usuario ${uid} no encontrado en Firestore`);
    }
    const currentData = userDoc.data() || {};

    // Resolver idEmpresas actual (array, escalar o faltante) → number[]
    const idEmpresas = this.resolveCurrentIdEmpresas(currentData);

    // Aplicar cambios idempotentes
    const next = new Set(idEmpresas);
    for (const e of add) next.add(e);
    for (const e of remove) next.delete(e);
    const newIdEmpresas = Array.from(next).sort((a, b) => a - b);

    await userRef.update({ idEmpresas: newIdEmpresas });

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
      photoURL: currentData?.picture ?? currentData?.photoURL ?? auth?.photoURL ?? null,
      roles: Array.isArray(currentData?.roles)
        ? currentData.roles.map((r: any) => String(r))
        : [],
      idEmpresas: newIdEmpresas,
    };
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

  private async fetchAuthRecords(uids: string[]): Promise<Map<string, admin.auth.UserRecord>> {
    const result = new Map<string, admin.auth.UserRecord>();
    if (uids.length === 0) return result;
    try {
      const res = await admin.auth().getUsers(uids.map((uid) => ({ uid })));
      for (const rec of res.users) result.set(rec.uid, rec);
    } catch (err) {
      console.warn('[usuarios] No se pudo enriquecer con Firebase Auth:', err);
    }
    return result;
  }
}
