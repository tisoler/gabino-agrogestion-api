import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Empresa } from './empresa.entity';

@Entity('lote')
export class Lote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_empresa' })
  idEmpresa: number;

  /**
   * UID de Firebase del usuario "dueño" del lote.
   * El usuario vive en Firestore y debe pertenecer a la empresa (id_empresa)
   * vía su campo idEmpresas. No hay FK en la BD.
   */
  @Column({ name: 'id_usuario', type: 'varchar', length: 128 })
  idUsuario: string;

  @Column({ nullable: true })
  descripcion: string;

  /**
   * Campo: texto de agrupación de lotes (p.ej. establecimiento o parcela).
   * Requerido.
   */
  @Column({ type: 'varchar', length: 200 })
  campo: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  lat: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  long: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
