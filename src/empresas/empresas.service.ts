import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as admin from "firebase-admin";
import { Empresa } from "../entities/empresa.entity";
import { capitalizarNombre } from "../utils/nombre";
import { Roles } from "src/constantes";
import { CreateEmpresaDto } from "./dto/create-empresa.dto";
import { UpdateEmpresaDto } from "./dto/update-empresa.dto";
import { FirestoreCacheService } from "../cache/firestore-cache.service";

export interface UsuarioBasico {
  uid: string;
  email: string | null;
  nombreUsuario: string | null;
  photoURL: string | null;
  celular: string | null;
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
    private cache: FirestoreCacheService,
  ) {}

  findAll(user: any): Promise<Empresa[]> {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    if (isAdmin) {
      return this.empresaRepository.find({
        where: { activo: true },
        order: { nombre: "ASC" },
      });
    }

    if (userEmpresas.length === 0) return Promise.resolve([]);

    return this.empresaRepository
      .createQueryBuilder("empresa")
      .where("empresa.id IN (:...ids)", { ids: userEmpresas })
      .andWhere("empresa.activo = :activo", { activo: true })
      .orderBy("empresa.nombre", "ASC")
      .getMany();
  }

  findOne(id: number): Promise<Empresa | null> {
    if (!id) return Promise.resolve(null);
    return this.empresaRepository.findOne({ where: { id } });
  }

  async create(
    createEmpresaDto: CreateEmpresaDto,
    user: any,
  ): Promise<Empresa> {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const isAsesor = user.roles?.includes(Roles.ASESOR);
    if (!isAdmin && !isAsesor) {
      throw new BadRequestException("No tiene permisos para crear empresas");
    }
    const empresa = this.empresaRepository.create({
      ...createEmpresaDto,
      nombre: capitalizarNombre(createEmpresaDto.nombre),
    });
    const saved = await this.empresaRepository.save(empresa);

    // Al crear una empresa, el asesor queda asociado automáticamente a ella:
    // se agrega el id a su `idEmpresas` en Firestore para que pueda verla y
    // gestionarla. Los admins (sys-admin / asesor-admin) ya ven todas.
    if (!isAdmin && isAsesor && user.id) {
      try {
        const db = admin.firestore();
        const userRef = db.collection("usuarios").doc(user.id);
        const userDoc = await userRef.get();
        const current = userDoc.exists
          ? this.resolveUserEmpresas(userDoc.data() || {})
          : [];
        const next = Array.from(new Set([...current, saved.id])).sort(
          (a, b) => a - b,
        );
        await userRef.set({ idEmpresas: next }, { merge: true });
      } catch (err) {
        console.warn(
          "[empresas] No se pudo auto-asociar al creador de la empresa:",
          err,
        );
      }
      // La asociación cambió: invalidar cache de auth del creador y listado.
      this.cache.invalidateUser(user.id);
      this.cache.invalidateAll();
    }

    return saved;
  }

  /**
   * Actualiza el nombre de una empresa en la BD. El nombre se normaliza a
   * mayúscula inicial por palabra (salvo la palabra "y").
   *
   * Reglas:
   *  - sys-admin / asesor-admin: pueden editar cualquier empresa.
   *  - asesor: sólo empresas de su propio `idEmpresas`.
   *  - productor: no autorizado (lo bloquea el controller con @Roles).
   */
  async update(
    id: number,
    updateEmpresaDto: UpdateEmpresaDto,
    user: any,
  ): Promise<Empresa> {
    const empresa = await this.findOne(id);
    if (!empresa) {
      throw new NotFoundException("Empresa no encontrada");
    }

    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    if (!isAdmin) {
      const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
        Number(e),
      );
      if (!userEmpresas.includes(id)) {
        throw new ForbiddenException(
          "No tiene permisos para modificar esta empresa",
        );
      }
    }

    empresa.nombre = capitalizarNombre(updateEmpresaDto.nombre);
    return this.empresaRepository.save(empresa);
  }

  async findAllWithUsers(user: any): Promise<EmpresaConUsuarios[]> {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const isAsesor = user.roles?.includes(Roles.ASESOR);

    if (!isAdmin && !isAsesor) {
      throw new ForbiddenException("No tiene permisos para ver esta sección");
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
        .sort((a, b) =>
          (a.nombreUsuario || "").localeCompare(b.nombreUsuario || ""),
        ),
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
  async findUsuariosByEmpresa(
    empresaId: number,
    user: any,
  ): Promise<UsuarioBasico[]> {
    const isAdmin =
      user.roles?.includes(Roles.SYS_ADMIN) ||
      user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );

    if (!isAdmin && !userEmpresas.includes(empresaId)) {
      throw new ForbiddenException(
        "No tiene permisos para ver los usuarios de esta empresa",
      );
    }

    // Verificar que la empresa existe (404 vs 200 vacío)
    const empresa = await this.findOne(empresaId);
    if (!empresa) {
      throw new NotFoundException("Empresa no encontrada");
    }

    const usuarios = await this.fetchFirestoreUsers({
      allowedEmpresas: new Set([empresaId]),
    });

    return usuarios.sort((a, b) =>
      (a.nombreUsuario || "").localeCompare(b.nombreUsuario || ""),
    );
  }

  /**
   * Helper: filtra el listado de usuarios cacheado (FirestoreCacheService) por
   * intersección con `allowedEmpresas`.
   *
   * El listado (todos los no sys-admin, con roles resueltos, empresas y datos
   * de Firebase Auth) se construye una sola vez y se sirve desde cache por
   * horas, invalidándose con POST /cache/invalidate o ante cambios de
   * asociación de empresas.
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
   */
  private async fetchFirestoreUsers(opts: {
    allowedEmpresas: Set<number>;
  }): Promise<UsuarioBasico[]> {
    const todos = await this.cache.getOrLoadUsuarios();
    return todos.filter((u) =>
      u.idEmpresas.some((e) => opts.allowedEmpresas.has(e)),
    );
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
