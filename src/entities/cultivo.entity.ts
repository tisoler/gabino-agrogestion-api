import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Variedad } from './variedad.entity';

@Entity('cultivo')
export class Cultivo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ name: 'id_empresa', nullable: true })
  idEmpresa: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => Variedad, (variedad) => variedad.cultivo)
  variedades: Variedad[];
}
