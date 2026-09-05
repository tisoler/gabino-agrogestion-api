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
import { Campania } from "./campania.entity";
import { Labor } from "./labor.entity";
import { PrescripcionInsumo } from "./prescripcion-insumo.entity";
import { PrescripcionCampania } from "./prescripcion-campania.entity";
import { decimalColumn } from "../utils/decimal";

@Entity("prescripcion")
export class Prescripcion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  fecha: string;

  /**
   * Producción principal (primer lote). Se conserva por compatibilidad:
   * el listado de lotes real vive en `lotes` (prescripcion_campania).
   */
  @Column({ name: "id_campania", nullable: true })
  idCampania: number | null;

  @ManyToOne(() => Campania, { eager: false })
  @JoinColumn({ name: "id_campania" })
  campania: Campania;

  @Column({ name: "id_labor" })
  idLabor: number;

  @ManyToOne(() => Labor, { eager: false })
  @JoinColumn({ name: "id_labor" })
  labor: Labor;

  @Column({ name: "total_ha_aplicacion", ...decimalColumn() })
  totalHaAplicacion: number;

  /**
   * Indicaciones sobre la labor a realizar. Opcional: se muestra en el
   * detalle y en el PDF (recuadro bajo la lista de insumos).
   */
  @Column({ type: "text", nullable: true })
  observaciones: string | null;

  @Column({ name: "anulada", default: false })
  anulada: boolean;

  /**
   * URL pública (DO Spaces) del PDF generado para compartir por WhatsApp.
   * Opcional: se crea al compartir por primera vez y se reutiliza en
   * sucesivos compartidos. La limpieza de PDFs viejos puede volver a
   * setearlo en NULL para forzar la regeneración.
   */
  @Column({ name: "pdf_url", type: "varchar", length: 1000, nullable: true })
  pdfUrl: string | null;

  @OneToMany(() => PrescripcionInsumo, (pi) => pi.prescripcion, {
    cascade: true,
  })
  insumos: PrescripcionInsumo[];

  /** Lotes (producciones) abarcados por la prescripción, con su superficie. */
  @OneToMany(() => PrescripcionCampania, (pc) => pc.prescripcion)
  lotes: PrescripcionCampania[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
