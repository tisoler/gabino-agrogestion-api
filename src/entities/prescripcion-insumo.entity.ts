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
import { Insumo } from "./insumo.entity";
import { decimalColumn } from "../utils/decimal";

@Entity("prescripcion_insumo")
export class PrescripcionInsumo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "id_prescripcion" })
  idPrescripcion: number;

  @ManyToOne(() => Prescripcion, (p) => p.insumos, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_prescripcion" })
  prescripcion: Prescripcion;

  @Column({ name: "id_insumo" })
  idInsumo: number;

  @ManyToOne(() => Insumo, { eager: false })
  @JoinColumn({ name: "id_insumo" })
  insumo: Insumo;

  @Column({ name: "cantidad_por_ha", ...decimalColumn() })
  cantidadPorHa: number;

  @Column({ name: "cantidad_total", ...decimalColumn() })
  cantidadTotal: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
