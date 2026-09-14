import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Campania } from "./campania.entity";

export type EstadoProduccionPago = "pendiente" | "pagado";

/**
 * Estado de pago de una producción (campaña).
 * Al pasar a "pagado" se congela `precioReferencia` + `monto` como registro
 * histórico; al volver a "pendiente" se limpian para que el monto vuelva a
 * calcularse en vivo con la pizarra vigente o la tarifa base.
 */
@Entity("produccion_pago")
export class ProduccionPago {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "id_campania", unique: true })
  idCampania: number;

  @ManyToOne(() => Campania, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_campania" })
  campania: Campania;

  @Column({ type: "varchar", length: 10, default: "pendiente" })
  estado: EstadoProduccionPago;

  /**
   * Precio de pizarra ($/Tn) usado al momento del pago. NULL cuando se usó
   * la tarifa base (`usoTarifaBase = true`).
   */
  @Column("decimal", {
    name: "precio_referencia",
    precision: 14,
    scale: 2,
    nullable: true,
  })
  precioReferencia: number | null;

  @Column({ name: "uso_tarifa_base", default: false })
  usoTarifaBase: boolean;

  /** Monto congelado al pasar a pagado. */
  @Column("decimal", { precision: 14, scale: 2, nullable: true })
  monto: number | null;

  @Column({ name: "fecha_pago", type: "timestamptz", nullable: true })
  fechaPago: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
