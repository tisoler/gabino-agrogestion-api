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

  @Column('decimal', { name: 'superficie_laboreada', precision: 14, scale: 4 })
  superficieLaboreada: number;

  @Column('decimal', { name: 'costo_labor_ha', precision: 14, scale: 4 })
  costoLaborHa: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
