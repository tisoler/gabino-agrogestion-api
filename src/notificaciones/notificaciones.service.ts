import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Response } from "express";
import {
  Notificacion,
  TipoNotificacion,
} from "../entities/notificacion.entity";

export interface NotificacionSseEvent {
  tipo: "notificacion" | "leidas";
  data: unknown;
}

export interface CrearNotificacionParams {
  idUsuario: string;
  tipo: TipoNotificacion;
  mensaje: string;
  idCampania: number | null;
  idPrescripcion: number | null;
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  /** uid de Firebase -> respuestas SSE activas del usuario. */
  private suscriptores = new Map<string, Set<Response>>();

  constructor(
    @InjectRepository(Notificacion)
    private readonly repo: Repository<Notificacion>,
  ) {}

  async listar(uid: string): Promise<Notificacion[]> {
    return this.repo.find({
      where: { idUsuario: uid },
      order: { createdAt: "DESC", id: "DESC" },
      take: 200,
    });
  }

  async noLeidas(uid: string): Promise<{ noLeidas: number }> {
    const noLeidas = await this.repo.count({
      where: { idUsuario: uid, leida: false },
    });
    return { noLeidas };
  }

  async marcarTodasLeidas(uid: string): Promise<{ ok: boolean }> {
    await this.repo.update({ idUsuario: uid, leida: false }, { leida: true });
    this.emitir(uid, { tipo: "leidas", data: { ok: true } });
    return { ok: true };
  }

  async marcarLeida(uid: string, id: number): Promise<Notificacion> {
    const notificacion = await this.repo.findOne({
      where: { id, idUsuario: uid },
    });
    if (!notificacion)
      throw new NotFoundException("Notificación no encontrada");
    if (!notificacion.leida) {
      notificacion.leida = true;
      await this.repo.save(notificacion);
      this.emitir(uid, { tipo: "leidas", data: { ok: true } });
    }
    return notificacion;
  }

  async crear(params: CrearNotificacionParams): Promise<Notificacion> {
    const notificacion = this.repo.create({ ...params, leida: false });
    const saved = await this.repo.save(notificacion);
    this.emitir(params.idUsuario, { tipo: "notificacion", data: saved });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // SSE
  // ---------------------------------------------------------------------------
  suscribir(uid: string, res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": conectado\n\n");

    const ping = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        /* cliente desconectado */
      }
    }, 20000);

    let set = this.suscriptores.get(uid);
    if (!set) {
      set = new Set();
      this.suscriptores.set(uid, set);
    }
    set.add(res);

    res.on("close", () => {
      clearInterval(ping);
      const s = this.suscriptores.get(uid);
      if (s) {
        s.delete(res);
        if (s.size === 0) this.suscriptores.delete(uid);
      }
    });

    this.logger.log(`SSE conectado para ${uid}`);
  }

  private emitir(uid: string, event: NotificacionSseEvent) {
    const set = this.suscriptores.get(uid);
    if (!set || set.size === 0) return;
    const msg = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of set) {
      try {
        res.write(msg);
      } catch {
        this.logger.warn(`No se pudo emitir a ${uid}`);
      }
    }
  }
}
