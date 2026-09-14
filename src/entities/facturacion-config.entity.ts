import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/**
 * Parámetros de facturación (clave → valor).
 * Hoy solo `tarifa_base` (monto a cobrar cuando el cultivo no tiene precio
 * de pizarra CAC). Editable por sys-admin desde la UI.
 */
@Entity("facturacion_config")
export class FacturacionConfig {
  @PrimaryColumn({ type: "varchar", length: 50 })
  clave: string;

  @Column("decimal", { precision: 14, scale: 2 })
  valor: number;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
