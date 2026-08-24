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
import { Costo } from "./costo.entity";
import { decimalColumn } from "../utils/decimal";

@Entity("campania_costo")
export class CampaniaCosto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "id_campania" })
  idCampania: number;

  @ManyToOne(() => Campania, (c) => c.costos, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_campania" })
  campania: Campania;

  @Column({ name: "id_costo" })
  idCosto: number;

  @ManyToOne(() => Costo, { eager: false })
  @JoinColumn({ name: "id_costo" })
  costo: Costo;

  @Column({ name: "unidades_ha", ...decimalColumn() })
  unidadesHa: number;

  @Column({ name: "costo_unidad", ...decimalColumn() })
  costoUnidad: number;

  @Column({ type: "text", nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
