import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Cultivo } from "./cultivo.entity";

@Entity("mensaje_masivo")
export class MensajeMasivo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  mensaje: string;

  @Column({ type: "timestamp" })
  fecha: Date;

  /**
   * UID de Firebase del usuario que envió el mensaje. Vive en Firestore,
   * no hay FK; email y nombre se denormalizan abajo.
   */
  @Column({ name: "id_usuario_emisor", type: "varchar", length: 128 })
  idUsuarioEmisor: string;

  @Column({ name: "email_emisor", nullable: true })
  emailEmisor: string | null;

  @Column({ name: "nombre_emisor", nullable: true })
  nombreEmisor: string | null;

  /** Período de la campaña usado para resolver los destinatarios (ej "25/26"). */
  @Column({ type: "varchar" })
  campania: string;

  @Column({ name: "id_cultivo", nullable: true })
  idCultivo: number | null;

  @ManyToOne(() => Cultivo, { eager: false, nullable: true })
  @JoinColumn({ name: "id_cultivo" })
  cultivo: Cultivo | null;

  /** Snapshot de celulares destinatarios (formato internacional). */
  @Column({ name: "telefonos_destino", type: "text", array: true })
  telefonosDestino: string[];

  /** Snapshot de emails destinatarios. */
  @Column({ name: "emails_destino", type: "text", array: true })
  emailsDestino: string[];
}
