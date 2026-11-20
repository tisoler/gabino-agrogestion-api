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
import { Cultivo } from "./cultivo.entity";
import { Variedad } from "./variedad.entity";
import { Aseguradora } from "./aseguradora.entity";
import { CampaniaLabor } from "./campania-labor.entity";
import { CampaniaInsumo } from "./campania-insumo.entity";
import { CampaniaCosto } from "./campania-costo.entity";

@Entity("campania")
export class Campania {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Período de la campaña (ej: "25/26"). Precargado en el FE con los períodos
   * válidos (desde 25/26 hasta el período actual).
   */
  @Column({ type: "varchar", length: 7 })
  campania: string;

  /**
   * Número visible de producción con forma E-AA-N (ej. 5-26-7): ámbito
   * productor (`numEmpresa`, snapshot del lote al crear), año de creación en
   * 2 dígitos y secuencial por (empresa, año). Inmutable (no cambia si se
   * mueve de lote).
   */
  @Column({ name: "num_empresa" })
  numEmpresa: number;

  @Column({ name: "num_anio" })
  numAnio: number;

  @Column({ name: "num_seq" })
  numSeq: number;

  @Column({ name: "id_lote" })
  idLote: number;

  @ManyToOne(() => Lote, { eager: false })
  @JoinColumn({ name: "id_lote" })
  lote: Lote;

  @Column({ name: "id_cultivo" })
  idCultivo: number;

  @ManyToOne(() => Cultivo, { eager: false })
  @JoinColumn({ name: "id_cultivo" })
  cultivo: Cultivo;

  @Column({ name: "id_variedad", nullable: true })
  idVariedad: number | null;

  @ManyToOne(() => Variedad, { eager: false, nullable: true })
  @JoinColumn({ name: "id_variedad" })
  variedad: Variedad | null;

  @Column("decimal", {
    name: "sup_sembrada",
    precision: 14,
    scale: 4,
    nullable: true,
  })
  supSembrada: number | null;

  @Column("decimal", {
    name: "sup_cosechada",
    precision: 14,
    scale: 4,
    nullable: true,
  })
  supCosechada: number | null;

  @Column("decimal", {
    name: "prod_neta_total_qq",
    precision: 14,
    scale: 4,
    nullable: true,
  })
  prodNetaTotalQq: number | null;

  @Column("decimal", {
    name: "precio_x_qq",
    precision: 14,
    scale: 4,
    nullable: true,
  })
  precioXQq: number | null;

  @Column("decimal", {
    name: "alquiler_qq_ha",
    precision: 14,
    scale: 4,
    nullable: true,
  })
  alquilerQqHa: number | null;

  /**
   * Precio del quintal usado para valuar el alquiler ($/qq). Editable en el
   * FE (con default visual de la pizarra según el cultivo). Si es NULL, los
   * cálculos usan `precioXQq` como fallback (compatibilidad con datos
   * anteriores a la migración 040).
   */
  @Column("decimal", {
    name: "alquiler_precio_x_qq",
    precision: 14,
    scale: 4,
    nullable: true,
  })
  alquilerPrecioXQq: number | null;

  /**
   * Fecha de siembra (opcional, editable). Backfill en la migración 041 con
   * la fecha mínima de las labores de siembra cargadas en cada producción.
   */
  @Column({ name: "fecha_siembra", type: "date", nullable: true })
  fechaSiembra: string | null;

  /** Empresa de seguros elegida al generar la planilla de seguros. */
  @Column({ name: "id_aseguradora", nullable: true })
  idAseguradora: number | null;

  @ManyToOne(() => Aseguradora, { eager: false, nullable: true })
  @JoinColumn({ name: "id_aseguradora" })
  aseguradora: Aseguradora | null;

  /** Quintales a asegurar (se fijan al descargar/compartir la planilla). */
  @Column("decimal", {
    name: "qq_asegurados",
    precision: 14,
    scale: 4,
    nullable: true,
  })
  qqAsegurados: number | null;

  @Column("decimal", {
    name: "comercializacion_pct",
    precision: 7,
    scale: 4,
    nullable: true,
  })
  comercializacionPct: number | null;

  @Column("decimal", {
    name: "cosecha_x_ha",
    precision: 14,
    scale: 4,
    nullable: true,
  })
  cosechaXHa: number | null;

  @OneToMany(() => CampaniaLabor, (cl) => cl.campania, { cascade: true })
  labores: CampaniaLabor[];

  @OneToMany(() => CampaniaInsumo, (ci) => ci.campania, { cascade: true })
  insumos: CampaniaInsumo[];

  @OneToMany(() => CampaniaCosto, (cc) => cc.campania, { cascade: true })
  costos: CampaniaCosto[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
