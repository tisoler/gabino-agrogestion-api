import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Campania } from "./campania.entity";

/**
 * Monitoreo en lote: registro de una visita/observación del asesor sobre
 * una producción (`campania`). Fecha + hora de la observación, diagnóstico
 * obligatorio y observaciones opcionales. Borrado lógico vía `activo`.
 */
@Entity("monitoreo_lote")
export class MonitoreoLote {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Producción monitoreada. NULL = borrador de audio libre con lote aún no
   * resuelto (visible en listados, resoluble vía PATCH idCampania).
   */
  @Column({ name: "id_campania", nullable: true })
  idCampania: number | null;

  @ManyToOne(() => Campania, { eager: false, nullable: true })
  @JoinColumn({ name: "id_campania" })
  campania: Campania | null;

  @Column({ type: "date" })
  fecha: string;

  @Column({ type: "time" })
  hora: string;

  @Column({ type: "text" })
  diagnostico: string;

  @Column({ type: "text", nullable: true })
  observaciones: string | null;

  /** UID de Firebase de quien creó el registro (trazabilidad). */
  @Column({
    name: "creado_por_uid",
    type: "varchar",
    length: 128,
    nullable: true,
  })
  creadoPorUid: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;

  /**
   * Estado de revisión: 'borrador' (generado desde audio, pendiente de
   * revisión) o 'confirmado' (flujo normal). Default 'confirmado'.
   */
  @Column({ type: "varchar", length: 16, default: "confirmado" })
  estado: string;

  /**
   * Cómo se creó: 'manual' | 'audio_libre' | 'audio_lote'. NULL = manual
   * (filas anteriores al spike de voz).
   */
  @Column({ type: "varchar", length: 16, nullable: true })
  origen: string | null;

  /**
   * Ciclo del audio: 'pendiente' | 'procesando' | 'a_revisar' | 'ok'.
   * NULL cuando no hay audio involucrado.
   */
  @Column({
    name: "transcripcion_estado",
    type: "varchar",
    length: 16,
    nullable: true,
  })
  transcripcionEstado: string | null;

  /** URL pública del audio en Spaces (re-escucha en revisión). */
  @Column({ name: "audio_url", type: "text", nullable: true })
  audioUrl: string | null;
}
