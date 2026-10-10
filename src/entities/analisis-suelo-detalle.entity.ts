import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { decimalColumn } from "../utils/decimal";
import { AnalisisSuelo } from "./analisis-suelo.entity";

/**
 * Una determinación medida del análisis (ej. materia orgánica 28.4 g/kg).
 * Sólo se guardan filas con valor (numérico o texto como "No Salino");
 * las determinaciones vacías del informe no generan detalle.
 */
@Entity("analisis_suelo_detalle")
export class AnalisisSueloDetalle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "id_analisis" })
  idAnalisis: number;

  @ManyToOne(() => AnalisisSuelo, (a) => a.detalles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_analisis" })
  analisis: AnalisisSuelo;

  /** Código normalizado del parámetro (ej. "materia_organica", "ph"). */
  @Column({ type: "varchar", length: 60 })
  parametro: string;

  /** Etiqueta legible (ej. "Materia Orgánica (M.O.)"). */
  @Column({ type: "varchar", length: 200 })
  etiqueta: string;

  @Column({ name: "valor_num", ...decimalColumn(), nullable: true })
  valorNum: number | null;

  /** Valor no numérico (ej. conductividad "No Salino"). */
  @Column({ name: "valor_texto", type: "varchar", length: 100, nullable: true })
  valorTexto: string | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  unidad: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  metodo: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
