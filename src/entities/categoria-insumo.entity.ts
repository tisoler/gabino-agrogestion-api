import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Insumo } from './insumo.entity';

@Entity('categoria_insumo')
export class CategoriaInsumo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => Insumo, (insumo) => insumo.categoria)
  insumos: Insumo[];
}
