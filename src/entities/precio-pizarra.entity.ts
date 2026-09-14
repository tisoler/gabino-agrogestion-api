import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

/**
 * Snapshot de un precio de pizarra CAC ($/Tn) por cereal y fecha.
 * Se guarda en cada scraping exitoso para tener fallback cuando el sitio
 * no responde y registro histórico de cotizaciones.
 */
@Entity("precio_pizarra")
@Unique("uq_precio_pizarra_cultivo_fecha", ["cultivo", "fechaPizarra"])
export class PrecioPizarra {
  @PrimaryGeneratedColumn()
  id: number;

  /** Clave normalizada del cereal: soja | girasol | maiz | trigo | sorgo */
  @Column({ type: "varchar", length: 30 })
  cultivo: string;

  /** Precio en $/Tn. NULL cuando el tablero marca S/C sin estimado. */
  @Column("decimal", {
    name: "precio_ars",
    precision: 14,
    scale: 2,
    nullable: true,
  })
  precioArs: number | null;

  @Column("decimal", {
    name: "precio_usd",
    precision: 14,
    scale: 2,
    nullable: true,
  })
  precioUsd: number | null;

  /** Fecha de la pizarra publicada por la CAC (no del scraping). */
  @Column("date", { name: "fecha_pizarra" })
  fechaPizarra: string;

  /** TRUE si el precio es estimado (tablero con clase "estimative" o "(E)"). */
  @Column({ default: false })
  estimado: boolean;

  /** TRUE si el tablero marca S/C sin precio estimado. */
  @Column({ name: "sin_cotizacion", default: false })
  sinCotizacion: boolean;

  /** TC BNA Comprador publicado junto a la pizarra. */
  @Column("decimal", {
    name: "tc_bna",
    precision: 14,
    scale: 2,
    nullable: true,
  })
  tcBna: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
