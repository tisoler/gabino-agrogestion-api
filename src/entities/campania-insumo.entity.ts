import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Campania } from './campania.entity';
import { Insumo } from './insumo.entity';

@Entity('campania_insumo')
export class CampaniaInsumo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_campania' })
  idCampania: number;

  @ManyToOne(() => Campania, (c) => c.insumos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_campania' })
  campania: Campania;

  @Column({ name: 'id_insumo' })
  idInsumo: number;

  @ManyToOne(() => Insumo, { eager: false })
  @JoinColumn({ name: 'id_insumo' })
  insumo: Insumo;

  @Column('decimal', { name: 'unidades_ha', precision: 14, scale: 4 })
  unidadesHa: number;

  @Column('decimal', { name: 'costo_unidad', precision: 14, scale: 4 })
  costoUnidad: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
