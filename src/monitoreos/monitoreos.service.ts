import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MonitoreoLote } from "../entities/monitoreo-lote.entity";
import { Campania } from "../entities/campania.entity";
import { Lote } from "../entities/lote.entity";
import { Roles } from "../constantes";
import { CreateMonitoreoDto } from "./dto/create-monitoreo.dto";
import { UpdateMonitoreoDto } from "./dto/update-monitoreo.dto";
import { SpacesService } from "../spaces/spaces.service";
import { TranscripcionService } from "./transcripcion.service";

export interface FindMonitoreosFilters {
  currentEmpresaId?: number;
  empresaIds?: number[];
  campanias?: string[];
  idCampo?: number[];
  idLote?: number[];
  idCultivo?: number[];
  idVariedad?: number[];
  idCampania?: number;
  estado?: string;
}

export interface CoberturaLote {
  idLote: number;
  lote: string | null;
  campo: string | null;
  idEmpresa: number;
  empresa: string | null;
  periodo: string;
  ultimoMonitoreo: { id: number; fecha: string; hora: string } | null;
  totalMonitoreos: number;
}

export interface DesdeAudioResultado {
  creado: MonitoreoLote;
  texto: string;
  /** Diagnóstico guardado (sin encabezado si se auto-resolvió el lote). */
  diagnostico: string;
  periodo: string;
  /** Lotes candidatos cuando no hubo resolución única. */
  candidatos?: CoberturaLote[];
  /** Producciones del lote cuando hay más de una en el período. */
  producciones?: {
    id: number;
    cultivo: string | null;
    variedad: string | null;
  }[];
  audioUrl: string | null;
}

@Injectable()
export class MonitoreosService {
  constructor(
    @InjectRepository(MonitoreoLote)
    private monitoreoRepo: Repository<MonitoreoLote>,
    @InjectRepository(Campania) private campaniaRepo: Repository<Campania>,
    @InjectRepository(Lote) private loteRepo: Repository<Lote>,
    private spaces: SpacesService,
    private transcripcion: TranscripcionService,
  ) {}

  private readonly logger = new Logger(MonitoreosService.name);

  // ---------------------------------------------------------------------------
  // Listado (con los mismos filtros de scope que /campanias)
  // ---------------------------------------------------------------------------
  /**
   * Lista monitoreos según el scope del usuario.
   *
   *  - sys-admin: ve todos. Si llega `currentEmpresaId` filtra a esa empresa.
   *  - asesor / productor: ve solo monitoreos de producciones de lotes cuyas
   *    empresas estén en su `idEmpresas`.
   *
   * Trae `campania` (+ lote, campo, cultivo, variedad) para que la grilla
   * muestre productor/lote/cultivo sin un segundo fetch.
   */
  async findAll(user: any, filters: FindMonitoreosFilters = {}) {
    const qb = this.monitoreoRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.campania", "c")
      .leftJoinAndSelect("c.lote", "lote")
      .leftJoinAndSelect("lote.campo", "campo")
      .leftJoinAndSelect("c.cultivo", "cultivo")
      .leftJoinAndSelect("c.variedad", "variedad")
      .where("m.activo = true");

    this.aplicarScope(qb, user, filters);

    if (filters.campanias && filters.campanias.length > 0) {
      qb.andWhere("c.campania IN (:...campanias)", {
        campanias: filters.campanias,
      });
    }
    if (filters.idCampo && filters.idCampo.length > 0) {
      const sinCampo = filters.idCampo.includes(0);
      const campos = filters.idCampo.filter((n) => n !== 0);
      if (campos.length === 0) {
        qb.andWhere("lote.id_campo IS NULL");
      } else if (sinCampo) {
        qb.andWhere(
          "(lote.id_campo IN (:...campos) OR lote.id_campo IS NULL)",
          {
            campos,
          },
        );
      } else {
        qb.andWhere("lote.id_campo IN (:...campos)", { campos });
      }
    }
    if (filters.idLote && filters.idLote.length > 0) {
      qb.andWhere("c.id_lote IN (:...idLote)", { idLote: filters.idLote });
    }
    if (filters.idCultivo && filters.idCultivo.length > 0) {
      qb.andWhere("c.id_cultivo IN (:...idCultivo)", {
        idCultivo: filters.idCultivo,
      });
    }
    if (filters.idVariedad && filters.idVariedad.length > 0) {
      qb.andWhere("c.id_variedad IN (:...idVariedad)", {
        idVariedad: filters.idVariedad,
      });
    }
    if (filters.idCampania) {
      qb.andWhere("m.id_campania = :idCampania", {
        idCampania: filters.idCampania,
      });
    }
    if (filters.estado === "borrador" || filters.estado === "confirmado") {
      qb.andWhere("m.estado = :estado", { estado: filters.estado });
    }

    qb.orderBy("m.fecha", "DESC")
      .addOrderBy("m.hora", "DESC")
      .addOrderBy("m.id", "DESC");
    return qb.getMany();
  }

  async findOne(id: number, user: any): Promise<MonitoreoLote> {
    const monitoreo = await this.monitoreoRepo.findOne({
      where: { id },
      relations: {
        campania: { lote: { campo: true }, cultivo: true, variedad: true },
      },
    });
    if (!monitoreo || !monitoreo.activo) {
      throw new NotFoundException("Monitoreo no encontrado");
    }
    if (monitoreo.idCampania == null) {
      // Borrador sin producción: solo el creador o sys-admin.
      const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
      const uid = String(user.firebaseUid ?? user.id ?? "");
      if (!isAdmin && (!uid || monitoreo.creadoPorUid !== uid)) {
        throw new ForbiddenException("No tiene permisos sobre este monitoreo");
      }
      return monitoreo;
    }
    await this.assertCampaniaAcceso(monitoreo.campania, user);
    return monitoreo;
  }

  /** Monitoreos de una producción (para /campanias/:id). */
  async findByCampania(
    idCampania: number,
    user: any,
  ): Promise<MonitoreoLote[]> {
    const campania = await this.campaniaOrThrow(idCampania);
    await this.assertCampaniaAcceso(campania, user);
    return this.monitoreoRepo.find({
      where: { idCampania, activo: true },
      order: { fecha: "DESC", hora: "DESC", id: "DESC" },
    });
  }

  async create(dto: CreateMonitoreoDto, user: any): Promise<MonitoreoLote> {
    if (dto.idCampania == null) {
      // Solo borradores de audio pueden nacer sin producción (lote a resolver).
      if (dto.estado !== "borrador") {
        throw new BadRequestException(
          "idCampania es obligatorio salvo borrador de audio",
        );
      }
      const monitoreo = this.monitoreoRepo.create({
        idCampania: null,
        fecha: dto.fecha,
        hora: dto.hora,
        diagnostico: dto.diagnostico.trim(),
        observaciones: dto.observaciones?.trim()
          ? dto.observaciones.trim()
          : null,
        creadoPorUid: user.firebaseUid ?? user.id ?? null,
        activo: true,
        estado: "borrador",
        origen: dto.origen ?? "audio_libre",
      });
      return this.monitoreoRepo.save(monitoreo);
    }
    const campania = await this.campaniaOrThrow(dto.idCampania);
    await this.assertCampaniaAcceso(campania, user);
    const monitoreo = this.monitoreoRepo.create({
      idCampania: campania.id,
      fecha: dto.fecha,
      hora: dto.hora,
      diagnostico: dto.diagnostico.trim(),
      observaciones: dto.observaciones?.trim()
        ? dto.observaciones.trim()
        : null,
      creadoPorUid: user.firebaseUid ?? user.id ?? null,
      activo: true,
      estado: dto.estado === "borrador" ? "borrador" : "confirmado",
      origen: dto.origen ?? "manual",
    });
    return this.monitoreoRepo.save(monitoreo);
  }

  async update(
    id: number,
    dto: UpdateMonitoreoDto,
    user: any,
  ): Promise<MonitoreoLote> {
    const monitoreo = await this.findOne(id, user);
    if (dto.fecha !== undefined) monitoreo.fecha = dto.fecha;
    if (dto.hora !== undefined) monitoreo.hora = dto.hora;
    if (dto.diagnostico !== undefined)
      monitoreo.diagnostico = dto.diagnostico.trim();
    if (dto.observaciones !== undefined)
      monitoreo.observaciones = dto.observaciones?.trim()
        ? dto.observaciones.trim()
        : null;
    if (dto.idCampania !== undefined) {
      // Resolver un borrador sin producción: asigna la producción validando scope.
      const campania = await this.campaniaOrThrow(dto.idCampania);
      await this.assertCampaniaAcceso(campania, user);
      monitoreo.idCampania = campania.id;
    }
    if (dto.estado !== undefined)
      monitoreo.estado = dto.estado === "borrador" ? "borrador" : "confirmado";
    await this.monitoreoRepo.save(monitoreo);
    // Al confirmar un borrador con audio, el audio se elimina de Spaces
    // (ya cumplió su rol de revisión). No bloquea la confirmación si falla.
    if (dto.estado === "confirmado" && monitoreo.audioUrl) {
      const url = monitoreo.audioUrl;
      try {
        await this.spaces.eliminarPorUrl(url);
      } catch (e) {
        this.logger.warn(
          `No se pudo eliminar audio ${url}: ${(e as Error).message}`,
        );
      }
      monitoreo.audioUrl = null;
      monitoreo.transcripcionEstado = "ok";
      await this.monitoreoRepo.save(monitoreo);
    }
    // Fresco con relaciones (la producción puede haber cambiado).
    return this.findOne(id, user);
  }

  async remove(id: number, user: any): Promise<{ ok: boolean }> {
    const monitoreo = await this.findOne(id, user);
    if (monitoreo.estado === "confirmado") {
      throw new ForbiddenException(
        "Solo se pueden eliminar monitoreos sin confirmar.",
      );
    }
    if (monitoreo.audioUrl) {
      try {
        await this.spaces.eliminarPorUrl(monitoreo.audioUrl);
      } catch (e) {
        this.logger.warn(
          `No se pudo eliminar audio ${monitoreo.audioUrl}: ${(e as Error).message}`,
        );
      }
    }
    monitoreo.activo = false;
    await this.monitoreoRepo.save(monitoreo);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Cobertura (spike B): último monitoreo por lote en un período
  // ---------------------------------------------------------------------------
  /**
   * Lotes del scope del usuario con su último monitoreo del período (siempre
   * campaña actual salvo `periodo` explícito). Sin monitoreo → primero
   * (`ultimoMonitoreo: null`); luego por fecha/hora asc (los más lejanos).
   */
  async cobertura(user: any, periodo?: string): Promise<CoberturaLote[]> {
    const per = periodo?.match(/^\d{2}\/\d{2}$/) ? periodo : periodoActual();
    const lotes = await this.lotesEnScope(user);
    if (lotes.length === 0) return [];
    const idsLote = lotes.map((l) => l.id);

    const campanias = await this.campaniaRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.cultivo", "cultivo")
      .leftJoinAndSelect("c.variedad", "variedad")
      .where("c.id_lote IN (:...idsLote)", { idsLote })
      .andWhere("c.campania = :per", { per })
      .getMany();
    const porLote = new Map<number, Campania[]>();
    for (const c of campanias) {
      const arr = porLote.get(c.idLote) ?? [];
      arr.push(c);
      porLote.set(c.idLote, arr);
    }
    const idsCampania = campanias.map((c) => c.id);
    const ultimos = new Map<number, MonitoreoLote>();
    const totales = new Map<number, number>();
    if (idsCampania.length > 0) {
      const mons = await this.monitoreoRepo
        .createQueryBuilder("m")
        .where("m.id_campania IN (:...idsCampania)", { idsCampania })
        .andWhere("m.activo = true")
        .orderBy("m.fecha", "DESC")
        .addOrderBy("m.hora", "DESC")
        .addOrderBy("m.id", "DESC")
        .getMany();
      for (const m of mons) {
        totales.set(m.idCampania, (totales.get(m.idCampania) ?? 0) + 1);
        if (!ultimos.has(m.idCampania)) ultimos.set(m.idCampania, m);
      }
    }

    const filas: CoberturaLote[] = lotes.map((l) => {
      const prods = porLote.get(l.id) ?? [];
      let ultimo: MonitoreoLote | null = null;
      let total = 0;
      for (const p of prods) {
        total += totales.get(p.id) ?? 0;
        const u = ultimos.get(p.id);
        if (
          u &&
          (!ultimo ||
            u.fecha > ultimo.fecha ||
            (u.fecha === ultimo.fecha && u.hora >= ultimo.hora))
        ) {
          ultimo = u;
        }
      }
      return {
        idLote: l.id,
        lote: l.descripcion ?? null,
        campo: l.campo?.nombre ?? null,
        idEmpresa: l.idEmpresa,
        empresa: l.empresa?.nombre ?? null,
        periodo: per,
        ultimoMonitoreo: ultimo
          ? {
              id: (ultimo as MonitoreoLote).id,
              fecha: (ultimo as MonitoreoLote).fecha,
              hora: (ultimo as MonitoreoLote).hora,
            }
          : null,
        totalMonitoreos: total,
      };
    });
    filas.sort((a, b) => {
      if (!a.ultimoMonitoreo && !b.ultimoMonitoreo) return 0;
      if (!a.ultimoMonitoreo) return -1;
      if (!b.ultimoMonitoreo) return 1;
      if (a.ultimoMonitoreo.fecha !== b.ultimoMonitoreo.fecha)
        return a.ultimoMonitoreo.fecha < b.ultimoMonitoreo.fecha ? -1 : 1;
      return a.ultimoMonitoreo.hora < b.ultimoMonitoreo.hora ? -1 : 1;
    });
    return filas;
  }

  // ---------------------------------------------------------------------------
  // Transcripción suelta (spike C): lote ya elegido, solo devuelve el texto
  // ---------------------------------------------------------------------------
  /**
   * Transcribe un audio sin guardar nada (el llamador crea el monitoreo
   * después). Reutiliza el proveedor configurado (stub|groq|openai).
   */
  async transcribirAudio(
    buffer: Buffer,
    nombreOriginal: string,
    mimeType: string,
  ): Promise<{ texto: string }> {
    const { texto } = await this.transcripcion.transcribir(
      buffer,
      nombreOriginal,
      mimeType,
    );
    return { texto };
  }

  // ---------------------------------------------------------------------------
  // Audio libre (spike A): transcribir + resolver lote → borrador
  // ---------------------------------------------------------------------------
  /**
   * Sube el audio a Spaces (si está configurado), lo transcribe y resuelve el
   * lote dentro del scope del asesor en el período actual. Si la resolución es
   * única crea el monitoreo en `borrador`; si no, devuelve el texto + los
   * candidatos para que la app complete los datos.
   */
  async crearDesdeAudio(
    user: any,
    buffer: Buffer,
    nombreOriginal: string,
    mimeType: string,
    opts: { fecha?: string; hora?: string } = {},
  ): Promise<DesdeAudioResultado> {
    const per = periodoActual();
    let audioUrl: string | null = null;
    try {
      const ext = (nombreOriginal.split(".").pop() ?? "m4a").toLowerCase();
      const key = this.spaces.generarKeyAudio(ext);
      audioUrl = await this.spaces.subirAudio(
        key,
        buffer,
        mimeType || "audio/m4a",
      );
    } catch (e) {
      // Sin Spaces configurado (o fallo de subida) se sigue sin audio_url.
      this.logger.warn(`Audio sin subir a Spaces: ${(e as Error).message}`);
    }

    const { texto } = await this.transcripcion.transcribir(
      buffer,
      nombreOriginal,
      mimeType,
    );

    const lotes = await this.lotesEnScope(user);
    const candidatos = this.rankearLotes(texto, lotes).slice(0, 5);
    const mejor = candidatos[0];
    const unico =
      candidatos.length > 0 &&
      mejor.puntaje >= 5 &&
      mejor.empresaPts >= 1.5 &&
      (candidatos.length === 1 || mejor.puntaje >= candidatos[1].puntaje + 2);

    const fecha =
      opts.fecha && /^\d{4}-\d{2}-\d{2}$/.test(opts.fecha)
        ? opts.fecha
        : new Date().toISOString().slice(0, 10);
    let hora = opts.hora ?? new Date().toTimeString().slice(0, 5);
    if (/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)) {
      hora = hora.length === 5 ? `${hora}:00` : hora;
    } else {
      hora = new Date().toTimeString().slice(0, 8);
    }

    const aCobertura = (l: Lote): CoberturaLote => ({
      idLote: l.id,
      lote: l.descripcion ?? null,
      campo: l.campo?.nombre ?? null,
      idEmpresa: l.idEmpresa,
      empresa: l.empresa?.nombre ?? null,
      periodo: per,
      ultimoMonitoreo: null,
      totalMonitoreos: 0,
    });

    // Resolución: lote único + producción única → idCampania.
    // En cualquier otro caso se guarda igual con idCampania NULL para
    // resolver después (la web lo muestra, el móvil lo resuelve).
    let idCampania: number | null = null;
    let producciones:
      | { id: number; cultivo: string | null; variedad: string | null }[]
      | undefined;
    if (unico && mejor) {
      const prods = await this.campaniaRepo.find({
        where: { idLote: mejor.lote.id, campania: per },
        relations: { cultivo: true, variedad: true },
      });
      const activas = prods.filter((p) => p.cultivo);
      if (activas.length === 1) {
        idCampania = activas[0].id;
      } else if (activas.length > 1) {
        producciones = activas.map((p) => ({
          id: p.id,
          cultivo: p.cultivo?.nombre ?? null,
          variedad: p.variedad?.nombre ?? null,
        }));
      }
    }

    const monitoreo = this.monitoreoRepo.create({
      idCampania,
      fecha,
      hora,
      diagnostico:
        idCampania != null && unico && mejor
          ? extraerObservacion(texto, mejor.lote)
          : texto,
      observaciones: null,
      creadoPorUid: user.firebaseUid ?? user.id ?? null,
      activo: true,
      estado: "borrador",
      origen: "audio_libre",
      transcripcionEstado: "a_revisar",
      audioUrl,
    });
    const creado = await this.monitoreoRepo.save(monitoreo);
    return {
      creado,
      texto,
      diagnostico: creado.diagnostico,
      periodo: per,
      candidatos:
        idCampania == null
          ? candidatos.map((c) => aCobertura(c.lote))
          : undefined,
      producciones,
      audioUrl,
    };
  }

  /** Lotes del scope del usuario (mismo criterio que aplicarScope). */
  private async lotesEnScope(user: any): Promise<Lote[]> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );
    const qb = this.loteRepo
      .createQueryBuilder("l")
      .leftJoinAndSelect("l.campo", "campo")
      .leftJoinAndSelect("l.empresa", "empresa")
      .where("l.activo = true");
    if (!isAdmin) {
      if (userEmpresas.length === 0) return [];
      qb.andWhere("l.id_empresa IN (:...ids)", { ids: userEmpresas });
    }
    qb.orderBy("l.id", "ASC");
    return qb.getMany();
  }

  /**
   * Heurística con tolerancia a errores de transcripción ("Lissandro"→
   * "Lisandro", "Lotte"→"Lote", "Catoli"→"Acatoli"): puntúa por similitud
   * de palabras (Levenshtein) en empresa (máx 3), lote (máx 5) y campo (1).
   * La resolución exige lote bien parado (≥5), alguna señal de empresa
   * (≥1.5, evita asignar el lote a otro productor) y margen (≥2).
   */
  private rankearLotes(
    texto: string,
    lotes: Lote[],
  ): { lote: Lote; puntaje: number; empresaPts: number }[] {
    const norm = normalizar(texto);
    if (!norm) return [];
    const rankeados = lotes
      .map((lote) => ({ lote, ...puntuarLote(norm, lote) }))
      .filter((r) => r.puntaje > 0);
    rankeados.sort((a, b) => b.puntaje - a.puntaje);
    return rankeados;
  }
  // ---------------------------------------------------------------------------
  // Helpers de scope (mismo patrón que campanias: sys-admin todo, resto sus empresas)
  // ---------------------------------------------------------------------------
  private aplicarScope(qb: any, user: any, filters: FindMonitoreosFilters) {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );
    // Borradores propios sin producción (lote a resolver): siempre visibles
    // para su creador, aunque el JOIN a lote sea NULL.
    const uid = String(user.firebaseUid ?? user.id ?? "");
    const propioSinProduccion = uid
      ? "OR (m.id_campania IS NULL AND m.creado_por_uid = :uidCreador)"
      : "";

    if (filters.empresaIds && filters.empresaIds.length > 0) {
      const ids = isAdmin
        ? filters.empresaIds
        : filters.empresaIds.filter((id) => userEmpresas.includes(id));
      if (ids.length === 0) {
        qb.andWhere("1 = 0");
        return;
      }
      qb.andWhere(`(lote.id_empresa IN (:...ids) ${propioSinProduccion})`, {
        ids,
        uidCreador: uid,
      });
    } else if (filters.currentEmpresaId) {
      const id = Number(filters.currentEmpresaId);
      if (!isAdmin && !userEmpresas.includes(id)) {
        qb.andWhere("1 = 0");
        return;
      }
      qb.andWhere(`(lote.id_empresa = :empresaId ${propioSinProduccion})`, {
        empresaId: id,
        uidCreador: uid,
      });
    } else if (!isAdmin) {
      if (userEmpresas.length === 0) {
        qb.andWhere("1 = 0");
        return;
      }
      qb.andWhere(`(lote.id_empresa IN (:...ids) ${propioSinProduccion})`, {
        ids: userEmpresas,
        uidCreador: uid,
      });
    }
  }

  private async campaniaOrThrow(idCampania: number): Promise<Campania> {
    const campania = await this.campaniaRepo.findOne({
      where: { id: idCampania },
      relations: { lote: true },
    });
    if (!campania) throw new NotFoundException("Producción no encontrada");
    return campania;
  }

  private async assertCampaniaAcceso(
    campania: Campania | null,
    user: any,
  ): Promise<void> {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    if (isAdmin) return;
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) =>
      Number(e),
    );
    const idEmpresa = campania?.lote?.idEmpresa;
    if (!campania || idEmpresa == null || !userEmpresas.includes(idEmpresa)) {
      throw new ForbiddenException("No tiene permisos sobre esta producción");
    }
  }
}

/**
 * Período de monitoreo vigente (abr–mar), espejo server de
 * `campaniaMonitoreoActual` del móvil. Ej: oct-2026 → "26/27".
 */
export function periodoActual(fecha: Date = new Date()): string {
  const anio = fecha.getFullYear();
  const y = fecha.getMonth() >= 3 ? anio : anio - 1;
  return `${String(y % 100).padStart(2, "0")}/${String((y + 1) % 100).padStart(2, "0")}`;
}

/** Minúsculas sin tildes ni signos, para matcheo de nombres por voz. */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distancia de edición (para tolerar errores de transcripción). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Similitud 0..1 entre dos palabras. */ export function similitud(
  a: string,
  b: string,
): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Palabras útiles para matcheo (sin muletillas de dictado ni 1 letra). */
export function palabras(s: string): string[] {
  const ignorar = new Set([
    "lote",
    "lotes",
    "lotte",
    "lotea",
    "campo",
    "productor",
    "productora",
    "establecimiento",
    "el",
    "la",
    "los",
    "las",
    "de",
    "del",
    "en",
  ]);
  return s.split(" ").filter((w) => {
    if (/^\d+$/.test(w)) return true;
    return w.length >= 3 && !ignorar.has(w);
  });
}

/**
 * Puntaje de un lote contra el texto normalizado (exportado para probar).
 * Empresa: promedio de mejor similitud por palabra (≥0.85→3, ≥0.7→1.5).
 * Lote: mención exacta (5), mejor palabra (≥0.85→4, ≥0.7→2), nº ("lote 7"→2).
 * Campo: mención exacta (1).
 */
export function puntuarLote(
  norm: string,
  lote: {
    descripcion?: string | null;
    empresa?: { nombre?: string | null } | null;
    campo?: { nombre?: string | null } | null;
  },
): { puntaje: number; empresaPts: number } {
  const tokens = palabras(norm);
  const mejorPalabra = (nombre: string): number => {
    const ws = palabras(nombre);
    if (ws.length === 0 || tokens.length === 0) return 0;
    let suma = 0;
    for (const w of ws) {
      let mejor = 0;
      for (const t of tokens) mejor = Math.max(mejor, similitud(w, t));
      suma += mejor;
    }
    return suma / ws.length;
  };

  const empresaSim = mejorPalabra(normalizar(lote.empresa?.nombre ?? ""));
  const empresaPts = empresaSim >= 0.85 ? 3 : empresaSim >= 0.7 ? 1.5 : 0;

  let lotePts = 0;
  const desc = normalizar(lote.descripcion ?? "");
  if (desc.length >= 3 && norm.includes(desc)) {
    lotePts = 5;
  } else {
    const s = mejorPalabra(desc);
    if (s >= 0.85) lotePts = 4;
    else if (s >= 0.7) lotePts = 2;
    if (lotePts === 0) {
      // Nº de lote ("lote 7", "lotte 7"): coincide número aislado.
      const num = desc.match(/\d+/)?.[0];
      if (num && new RegExp(`\\blot+e+a?\\s*0*${num}\\b`).test(norm))
        lotePts = 2;
    }
  }

  const campo = normalizar(lote.campo?.nombre ?? "");
  const campoPts = campo.length >= 4 && norm.includes(campo) ? 1 : 0;

  return { puntaje: empresaPts + lotePts + campoPts, empresaPts };
}

/**
 * Recorta el encabezado "Productor X, Lote Y" del diagnóstico cuando el lote
 * fue auto-resuelto: el usuario dice esos datos al principio por convención y
 * no aportan a la observación. Solo recorta si las menciones aparecen al
 * inicio (primeros 160 caracteres, primera en los primeros 30) y si queda
 * texto útil (≥15 caracteres); si no, devuelve el texto intacto.
 * Cuando NO se resolvió no se recorta: el texto completo es la evidencia
 * para resolver manualmente.
 */
export function extraerObservacion(
  texto: string,
  lote: {
    descripcion?: string | null;
    empresa?: { nombre?: string | null } | null;
    campo?: { nombre?: string | null } | null;
  },
): string {
  const lower = texto.toLowerCase();
  const tokens: { word: string; end: number }[] = [];
  const re = /[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    tokens.push({ word: m[0], end: m.index + m[0].length });
  }
  if (tokens.length === 0) return texto;

  const objetivos = [
    ...palabras(normalizar(lote.empresa?.nombre ?? "")),
    ...palabras(normalizar(lote.descripcion ?? "")),
    ...palabras(normalizar(lote.campo?.nombre ?? "")),
  ];
  if (objetivos.length === 0) return texto;

  let inicio = Infinity;
  let fin = -1;
  let hallados = 0;
  const inicioTexto = lower.search(/[^\s]/);
  for (const obj of objetivos) {
    let mejor = 0;
    let mejorFin = -1;
    let mejorInicio = Infinity;
    for (const t of tokens) {
      const s = similitud(normalizar(t.word), obj);
      if (s > mejor) {
        mejor = s;
        mejorFin = t.end;
        mejorInicio = t.end - t.word.length;
      }
    }
    if (mejor >= 0.7) {
      hallados++;
      fin = Math.max(fin, mejorFin);
      inicio = Math.min(inicio, mejorInicio);
    }
  }
  if (hallados === 0 || inicio - inicioTexto > 30 || fin > 160) return texto;

  const resto = texto
    .slice(fin)
    .replace(/^[\s,.:;\-–—]+/, "")
    .trim();
  if (resto.length < 15) return texto;
  return resto.charAt(0).toUpperCase() + resto.slice(1);
}
