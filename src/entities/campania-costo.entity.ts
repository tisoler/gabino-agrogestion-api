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
import { Costo } from './costo.entity';

@Entity('campania_costo')
export class CampaniaCosto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_campania' })
  idCampania: number;

  @ManyToOne(() => Campania, (c) => c.costos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_campania' })
  campania: Campania;

  @Column({ name: 'id_costo' })
  idCosto: number;

  @ManyToOne(() => Costo, { eager: false })
  @JoinColumn({ name: 'id_costo' })
  costo: Costo;

  @Column('decimal', { name: 'unidades_ha', precision: 14, scale: 4 })
  unidadesHa: number;

  @Column('decimal', { name: 'costo_unidad', precision: 14, scale: 4 })
  costoUnidad: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
