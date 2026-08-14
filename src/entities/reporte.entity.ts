import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Empresa } from './empresa.entity';
import { ReporteFila } from './reporte-fila.entity';

export type TipoReporte = 'resumen_campania' | 'detalle_asesoramiento';
export type TipoCosecha = 'fina' | 'gruesa';

/**
 * Cabecera de un reporte. Se guardan sólo los ids necesarios; los valores
 * calculados (márgenes, asesoramiento) se resuelven al presentar, porque la
 * producción puede modificarse después.
 */
@Entity('reporte')
export class Reporte {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_empresa' })
  idEmpresa: number;

  @ManyToOne(() => Empresa, { eager: false })
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  /** Período de campaña (ej: "25/26"). */
  @Column({ type: 'varchar', length: 7 })
  campania: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: TipoReporte;

  /** Sólo para "detalle_asesoramiento": fina | gruesa. */
  @Column({ name: 'tipo_cosecha', type: 'varchar', length: 10, nullable: true })
  tipoCosecha: TipoCosecha | null;

  /** % de asesoramiento general (detalle); por fila puede editarse. Decimal (0,015 = 1,5%). */
  @Column({ name: 'asesoramiento_porcentaje', type: 'decimal', precision: 10, scale: 6, nullable: true })
  asesoramientoPorcentaje: number | null;

  /** Aplica IVA (21%) al total de asesoramiento (detalle). */
  @Column({ name: 'aplica_iva', default: false })
  aplicaIva: boolean;

  @OneToMany(() => ReporteFila, (f) => f.reporte, { cascade: true })
  filas: ReporteFila[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
