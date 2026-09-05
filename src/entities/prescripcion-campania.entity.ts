import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Prescripcion } from "./prescripcion.entity";
import { Campania } from "./campania.entity";
import { decimalColumn } from "../utils/decimal";

@Entity("prescripcion_campania")
export class PrescripcionCampania {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "id_prescripcion" })
  idPrescripcion: number;

  @ManyToOne(() => Prescripcion, (p) => p.lotes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_prescripcion" })
  prescripcion: Prescripcion;

  @Column({ name: "id_campania" })
  idCampania: number;

  @ManyToOne(() => Campania, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_campania" })
  campania: Campania;

  /** Hectáreas a aplicar en este lote (producción). */
  @Column({ name: "superficie_aplicada", ...decimalColumn() })
  superficieAplicada: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
