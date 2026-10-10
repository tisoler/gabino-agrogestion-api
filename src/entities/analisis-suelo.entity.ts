import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Lote } from "./lote.entity";
import { AnalisisSueloDetalle } from "./analisis-suelo-detalle.entity";

/**
 * Cabecera de un informe de análisis de suelo asociado a un lote.
 * Un lote puede tener varios (por fecha y profundidad). El archivo original
 * no se persiste: se extrae vía OCR, se previsualiza y el usuario acepta o
 * ajusta antes de guardar.
 */
@Entity("analisis_suelo")
export class AnalisisSuelo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "id_lote" })
  idLote: number;

  @ManyToOne(() => Lote, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_lote" })
  lote: Lote;

  @Column({ nullable: true })
  laboratorio: string | null;

  @Column({ name: "nro_analisis", nullable: true })
  nroAnalisis: string | null;

  @Column({ name: "fecha_recepcion", type: "date", nullable: true })
  fechaRecepcion: string | null;

  @Column({ name: "fecha_emision", type: "date", nullable: true })
  fechaEmision: string | null;

  @Column({ nullable: true })
  profundidad: string | null;

  @Column({ nullable: true })
  muestra: string | null;

  @OneToMany(() => AnalisisSueloDetalle, (d) => d.analisis, { cascade: true })
  detalles: AnalisisSueloDetalle[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
