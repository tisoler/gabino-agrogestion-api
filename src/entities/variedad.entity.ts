import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Cultivo } from './cultivo.entity';

@Entity('variedad')
export class Variedad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_cultivo' })
  idCultivo: number;

  @Column()
  nombre: string;

  @Column({ name: 'id_empresa', nullable: true })
  idEmpresa: number;

  @ManyToOne(() => Cultivo, (cultivo) => cultivo.variedades)
  @JoinColumn({ name: 'id_cultivo' })
  cultivo: Cultivo;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
