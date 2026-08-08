import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Empresa } from './empresa.entity';
import { CategoriaInsumo } from './categoria-insumo.entity';
import { decimalColumn } from '../utils/decimal';

@Entity('insumo')
export class Insumo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ name: 'id_categoria', nullable: true })
  idCategoria: number;

  @ManyToOne(() => CategoriaInsumo, (categoria) => categoria.insumos, { nullable: true })
  @JoinColumn({ name: 'id_categoria' })
  categoria: CategoriaInsumo;

  @Column({ name: 'id_empresa', nullable: true })
  idEmpresa: number;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({
    name: 'precio_unitario',
    nullable: true,
    ...decimalColumn(),
  })
  precioUnitario: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
