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
import { decimalColumn } from '../utils/decimal';

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

  @Column({ name: 'unidades_ha', ...decimalColumn() })
  unidadesHa: number;

  @Column({ name: 'costo_unidad', ...decimalColumn() })
  costoUnidad: number;

  @Column({ name: 'superficie_aplicada', ...decimalColumn() })
  superficieAplicada: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
