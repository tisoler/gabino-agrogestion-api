import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Empresa de seguros para las planillas de granizo (ej: La Dulce, La Segunda).
 * Catálogo global administrado por sys-admin.
 */
@Entity("aseguradora")
export class Aseguradora {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 200 })
  nombre: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
