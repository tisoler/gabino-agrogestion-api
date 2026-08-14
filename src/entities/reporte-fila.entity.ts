import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Reporte } from './reporte.entity';
import { Lote } from './lote.entity';
import { Campania } from './campania.entity';

/**
 * Fila de un reporte. Guarda la referencia a la/s producción/es (campaña):
 *  - "resumen_campania": id_lote + id_produccion_fina / id_produccion_gruesa.
 *  - "detalle_asesoramiento": id_lote + id_produccion + porcentaje_asesoramiento.
 * Los valores calculados se resuelven al presentar (la producción puede cambiar).
 */
@Entity('reporte_fila')
export class ReporteFila {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_reporte' })
  idReporte: number;

  @ManyToOne(() => Reporte, (r) => r.filas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_reporte' })
  reporte: Reporte;

  @Column({ name: 'id_lote' })
  idLote: number;

  @ManyToOne(() => Lote, { eager: false })
  @JoinColumn({ name: 'id_lote' })
  lote: Lote;

  /** Producción (detalle_asesoramiento). */
  @Column({ name: 'id_produccion', type: 'int', nullable: true })
  idProduccion: number | null;

  @ManyToOne(() => Campania, { eager: false })
  @JoinColumn({ name: 'id_produccion' })
  produccion: Campania | null;

  /** Producción de cosecha fina (resumen_campania). */
  @Column({ name: 'id_produccion_fina', type: 'int', nullable: true })
  idProduccionFina: number | null;

  @ManyToOne(() => Campania, { eager: false })
  @JoinColumn({ name: 'id_produccion_fina' })
  produccionFina: Campania | null;

  /** Producción de cosecha gruesa (resumen_campania). */
  @Column({ name: 'id_produccion_gruesa', type: 'int', nullable: true })
  idProduccionGruesa: number | null;

  @ManyToOne(() => Campania, { eager: false })
  @JoinColumn({ name: 'id_produccion_gruesa' })
  produccionGruesa: Campania | null;

  @Column({ name: 'porcentaje_asesoramiento', type: 'decimal', precision: 10, scale: 6, nullable: true })
  porcentajeAsesoramiento: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
