import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Empresa } from "./empresa.entity";
import { decimalColumn } from "../utils/decimal";

@Entity("costo")
export class Costo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ name: "id_empresa", nullable: true })
  idEmpresa: number;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: "id_empresa" })
  empresa: Empresa;

  /**
   * UID de Firebase del asesor dueño (alcance "todos sus productores").
   * NULL + id_empresa NULL = global; NULL + id_empresa = de esa empresa.
   */
  @Column({
    name: "uid_propietario",
    type: "varchar",
    length: 128,
    nullable: true,
  })
  uidPropietario: string | null;

  @Column({
    name: "precio_unitario",
    nullable: true,
    ...decimalColumn(),
  })
  precioUnitario: number | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  unidad: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
