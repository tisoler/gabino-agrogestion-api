import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Lote } from './lote.entity';
import { Empresa } from './empresa.entity';

@Entity('campo')
export class Campo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ name: 'id_empresa', nullable: true })
  idEmpresa: number;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ nullable: true })
  descripcion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => Lote, (lote) => lote.campo)
  lotes: Lote[];
}
