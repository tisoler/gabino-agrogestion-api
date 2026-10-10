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

  @Column({ name: "id_campania" })
  idCampania: number;

  @ManyToOne(() => Campania, { eager: false })
  @JoinColumn({ name: "id_campania" })
  campania: Campania;

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
}
