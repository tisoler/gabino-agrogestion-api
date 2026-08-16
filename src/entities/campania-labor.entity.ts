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
import { decimalColumn } from '../utils/decimal';
import { Labor } from './labor.entity';

@Entity('campania_labor')
export class CampaniaLabor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_campania' })
  idCampania: number;

  @ManyToOne(() => Campania, (c) => c.labores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_campania' })
  campania: Campania;

  @Column({ name: 'id_labor' })
  idLabor: number;

  @ManyToOne(() => Labor, { eager: false })
  @JoinColumn({ name: 'id_labor' })
  labor: Labor;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ name: 'superficie_laboreada', ...decimalColumn() })
  superficieLaboreada: number;

  @Column({ name: 'costo_labor_ha', ...decimalColumn() })
  costoLaborHa: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
