import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Empresa } from './empresa.entity';
import { Productor } from './productor.entity';

@Entity('lote')
export class Lote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_empresa' })
  idEmpresa: number;

  @Column({ name: 'id_productor' })
  idProductor: number;

  @Column({ nullable: true })
  descripcion: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  lat: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  long: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @ManyToOne(() => Productor)
  @JoinColumn({ name: 'id_productor' })
  productor: Productor;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
