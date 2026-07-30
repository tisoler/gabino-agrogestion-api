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
import { Lote } from './lote.entity';
import { Cultivo } from './cultivo.entity';
import { Variedad } from './variedad.entity';
import { CampaniaLabor } from './campania-labor.entity';
import { CampaniaInsumo } from './campania-insumo.entity';
import { CampaniaCosto } from './campania-costo.entity';

@Entity('campania')
export class Campania {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ name: 'anio_desde' })
  anioDesde: number;

  @Column({ name: 'anio_hasta' })
  anioHasta: number;

  @Column({ name: 'id_lote' })
  idLote: number;

  @ManyToOne(() => Lote, { eager: false })
  @JoinColumn({ name: 'id_lote' })
  lote: Lote;

  @Column({ name: 'id_cultivo' })
  idCultivo: number;

  @ManyToOne(() => Cultivo, { eager: false })
  @JoinColumn({ name: 'id_cultivo' })
  cultivo: Cultivo;

  @Column({ name: 'id_variedad', nullable: true })
  idVariedad: number | null;

  @ManyToOne(() => Variedad, { eager: false, nullable: true })
  @JoinColumn({ name: 'id_variedad' })
  variedad: Variedad | null;

  @Column('decimal', { name: 'sup_sembrada', precision: 14, scale: 4, nullable: true })
  supSembrada: number | null;

  @Column('decimal', { name: 'sup_cosechada', precision: 14, scale: 4, nullable: true })
  supCosechada: number | null;

  @Column('decimal', { name: 'prod_neta_total_qq', precision: 14, scale: 4, nullable: true })
  prodNetaTotalQq: number | null;

  @Column('decimal', { name: 'precio_x_qq', precision: 14, scale: 4, nullable: true })
  precioXQq: number | null;

  @Column('decimal', { name: 'alquiler_qq_ha', precision: 14, scale: 4, nullable: true })
  alquilerQqHa: number | null;

  @Column('decimal', { name: 'comercializacion_pct', precision: 7, scale: 4, nullable: true })
  comercializacionPct: number | null;

  @Column('decimal', { name: 'cosecha_x_ha', precision: 14, scale: 4, nullable: true })
  cosechaXHa: number | null;

  @OneToMany(() => CampaniaLabor, (cl) => cl.campania, { cascade: true })
  labores: CampaniaLabor[];

  @OneToMany(() => CampaniaInsumo, (ci) => ci.campania, { cascade: true })
  insumos: CampaniaInsumo[];

  @OneToMany(() => CampaniaCosto, (cc) => cc.campania, { cascade: true })
  costos: CampaniaCosto[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
