import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { Empresa } from '../entities/empresa.entity';
import { Roles } from 'src/constantes';
import { CreateEmpresaDto } from './dto/create-empresa.dto';

export interface UsuarioBasico {
  uid: string;
  email: string | null;
  nombreUsuario: string | null;
  photoURL: string | null;
  roles: string[];
  idEmpresas: number[];
}

export interface EmpresaConUsuarios extends Empresa {
  usuarios: UsuarioBasico[];
}

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa)
    private empresaRepository: Repository<Empresa>,
  ) { }

  findAll(user: any): Promise<Empresa[]> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (isAdmin) {
      return this.empresaRepository.find({
        where: { activo: true },
        order: { nombre: 'ASC' },
      });
    }

    if (userEmpresas.length === 0) return Promise.resolve([]);

    return this.empresaRepository.createQueryBuilder('empresa')
      .where('empresa.id IN (:...ids)', { ids: userEmpresas })
      .andWhere('empresa.activo = :activo', { activo: true })
      .orderBy('empresa.nombre', 'ASC')
      .getMany();
  }

  findOne(id: number): Promise<Empresa | null> {
    if (!id) return Promise.resolve(null);
    return this.empresaRepository.findOne({ where: { id } });
  }

  async create(createEmpresaDto: CreateEmpresaDto, user: any): Promise<Empresa> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const isAsesor = user.roles?.includes(Roles.ASESOR);
    if (!isAdmin && !isAsesor) {
      throw new BadRequestException('No tiene permisos para crear empresas');
    }
    const empresa = this.empresaRepository.create(createEmpresaDto);
    const saved = await this.empresaRepository.save(empresa);

    // Al crear una empresa, el asesor queda asociado automáticamente a ella:
    // se agrega el id a su `idEmpresas` en Firestore para que pueda verla y
    // gestionarla. Los admins (sys-admin / asesor-admin) ya ven todas.
    if (!isAdmin && isAsesor && user.id) {
      try {
        const db = admin.firestore();
        const userRef = db.collection('usuarios').doc(user.id);
        const userDoc = await userRef.get();
        const current = userDoc.exists ? this.resolveUserEmpresas(userDoc.data() || {}) : [];
        const next = Array.from(new Set([...current, saved.id])).sort((a, b) => a - b);
        await userRef.set({ idEmpresas: next }, { merge: true });
      } catch (err) {
        console.warn('[empresas] No se pudo auto-asociar al creador de la empresa:', err);
      }
    }

    return saved;
  }

  async findAllWithUsers(user: any): Promise<EmpresaConUsuarios[]> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const isAsesor = user.roles?.includes(Roles.ASESOR);

    if (!isAdmin && !isAsesor) {
      throw new ForbiddenException('No tiene permisos para ver esta sección');
    }

    const companies = await this.findAll(user);

    if (companies.length === 0) {
      return [];
    }

    const companyIds = new Set(companies.map((c) => c.id));

    const usuarios = await this.fetchFirestoreUsers({
      allowedEmpresas: companyIds,
    });

    return companies.map<EmpresaConUsuarios>((c) => ({
      ...c,
      usuarios: usuarios
        .filter((u) => u.idEmpresas.includes(c.id))
        .sort((a, b) => (a.nombreUsuario || '').localeCompare(b.nombreUsuario || '')),
    }));
  }

  /**
   * Devuelve los usuarios (asesores y productores) vinculados a una empresa concreta.
   * Pensado para alimentar pickers (e.g. "dueño del lote") desde el FE.
   *
   * Reglas de acceso:
   *  - sys-admin: puede pedir cualquier empresa.
   *  - asesor / productor: sólo empresas de su `idEmpresas`.
   *  - sys-admin con idEmpresas poblado: idEmpresas se ignora (ver strategy).
   */
  async findUsuariosByEmpresa(empresaId: number, user: any): Promise<UsuarioBasico[]> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isAdmin && !userEmpresas.includes(empresaId)) {
      throw new ForbiddenException('No tiene permisos para ver los usuarios de esta empresa');
    }

    // Verificar que la empresa existe (404 vs 200 vacío)
    const empresa = await this.findOne(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const usuarios = await this.fetchFirestoreUsers({
      allowedEmpresas: new Set([empresaId]),
    });

    return usuarios.sort((a, b) => (a.nombreUsuario || '').localeCompare(b.nombreUsuario || ''));
  }

  /**
   * Helper: trae todos los usuarios de Firestore con rol asesor o productor,
   * filtrados por intersección con `allowedEmpresas`.
   *
   * Tanto sys-admin como asesor/productor se filtran por empresa: el
   * endpoint `findUsuariosByEmpresa` se invoca con un único empresaId, y
   * sólo se devuelven los usuarios cuya `idEmpresas` contiene esa empresa.
   * Esto aplica también a sys-admin: si crea un lote en empresa 1, sólo
   * puede asignar un usuario que pertenezca a empresa 1.
   *
   * Para el endpoint `findAllWithUsers` (vista Productores), `allowedEmpresas`
   * es el set de todas las empresas visibles para el usuario, y la
   * iteración posterior por empresa filtra correctamente.
   *
   * Resiliente a variaciones de schema en Firestore:
   *  - Rol: `roles: string[]`  |  `rol: string`  |  `idRol: string` (FK → roles.nombre)
   *  - Empresas: `idEmpresas: number[]`  |  `idEmpresas: string[]`  |
   *    `idEmpresas: <escalar>`  |  `idEmpresa: <escalar>`
   *
   * Enriquecimiento: el documento de Firestore puede no traer `email` ni
   * `nombre`. En ese caso consultamos Firebase Auth en batch (un round-trip
   * cada 100 UIDs) y completamos los datos desde el Auth record. El email
   * siempre se prefiere desde Auth (fuente de verdad).
   */
  private async fetchFirestoreUsers(opts: {
    allowedEmpresas: Set<number>
  }): Promise<UsuarioBasico[]> {
    const db = admin.firestore();

    // Pre-fetch de la colección roles para resolver idRol → nombre
    const rolesSnap = await db.collection('roles').get();
    const roleById = new Map<string, string>();
    for (const doc of rolesSnap.docs) {
      const data = doc.data();
      const nombre = data?.nombre;
      if (typeof nombre === 'string' && nombre) {
        roleById.set(doc.id, nombre);
      }
    }

    const usersSnap = await db.collection('usuarios').get();
    const candidatos: { docId: string; data: any; roles: string[]; idEmpresas: number[] }[] = [];

    for (const doc of usersSnap.docs) {
      const data = doc.data();

      const roles = this.resolveUserRoles(data, roleById);
      // Incluye asesor, asesor-admin y productor: el asesor-admin cumple además
      // el rol de asesor (vinculado a empresas) aunque sea admin para ver/editar todo.
      if (
        !roles.includes(Roles.ASESOR) &&
        !roles.includes(Roles.ASESOR_ADMIN) &&
        !roles.includes(Roles.PRODUCTOR)
      ) {
        continue;
      }

      const idEmpresas = this.resolveUserEmpresas(data);

      // Filtro uniforme: la intersección con allowedEmpresas es lo que
      // define si el usuario es "visible" para esta consulta. Para
      // findUsuariosByEmpresa, allowedEmpresas = Set([empresaId]); para
      // findAllWithUsers, es el set de empresas del usuario autenticado.
      if (!idEmpresas.some((e) => opts.allowedEmpresas.has(e))) {
        continue;
      }

      candidatos.push({ docId: doc.id, data, roles, idEmpresas });
    }

    if (candidatos.length === 0) return [];

    // Enriquecer con Firebase Auth: nombre/email pueden faltar en Firestore.
    const authByUid = await this.fetchAuthRecords(candidatos.map((c) => c.docId));

    return candidatos.map(({ docId, data, roles, idEmpresas }) => {
      const auth = authByUid.get(docId);
      return {
        uid: docId,
        // Email: Auth es la fuente de verdad; Firestore es fallback.
        email: auth?.email ?? data?.email ?? null,
        // Nombre: priorizar Firestore (controlado por el admin), luego Auth.
        nombreUsuario:
          data?.nombre ?? data?.nombreUsuario ?? auth?.displayName ?? auth?.email ?? docId,
        photoURL: data?.picture ?? data?.photoURL ?? auth?.photoURL ?? null,
        roles,
        idEmpresas,
      };
    });
  }

  /**
   * Batch-fetch de Firebase Auth records (hasta 100 por llamada).
   * Devuelve un Map uid → UserRecord. Si un uid no existe en Auth, se ignora.
   */
  private async fetchAuthRecords(uids: string[]): Promise<Map<string, admin.auth.UserRecord>> {
    const result = new Map<string, admin.auth.UserRecord>();
    if (uids.length === 0) return result;

    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += 100) {
      chunks.push(uids.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        const res = await admin.auth().getUsers(chunk.map((uid) => ({ uid })));
        for (const rec of res.users) {
          result.set(rec.uid, rec);
        }
      } catch (err) {
        // Si falla el batch (e.g. permisos IAM), seguimos sin enriquecimiento.
        console.warn('[empresas] No se pudo enriquecer con Firebase Auth:', err);
      }
    }

    return result;
  }

  private resolveUserRoles(data: any, roleById: Map<string, string>): string[] {
    if (Array.isArray(data?.roles) && data.roles.length > 0) {
      return data.roles.map((r: any) => String(r));
    }
    if (typeof data?.rol === 'string' && data.rol) {
      return [data.rol];
    }
    if (data?.idRol && roleById.has(data.idRol)) {
      return [roleById.get(data.idRol)!];
    }
    return [];
  }

  private resolveUserEmpresas(data: any): number[] {
    // Aceptar idEmpresas como:
    //   - array:        ["1", "2"]  ó  [1, 2]
    //   - escalar:       "2"  ó  2
    //   - idEmpresa (legacy, singular)
    if (Array.isArray(data?.idEmpresas)) {
      return data.idEmpresas
        .map((e: any) => Number(e))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    }
    if (data?.idEmpresas !== undefined && data?.idEmpresas !== null) {
      const n = Number(data.idEmpresas);
      return Number.isFinite(n) && n > 0 ? [n] : [];
    }
    if (data?.idEmpresa !== undefined && data?.idEmpresa !== null) {
      const n = Number(data.idEmpresa);
      return Number.isFinite(n) && n > 0 ? [n] : [];
    }
    return [];
  }
}
