import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Variedad } from "./variedad.entity";

@Entity("cultivo")
export class Cultivo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ name: "tipo_cosecha", type: "varchar", length: 10, nullable: true })
  tipoCosecha: string;

  @Column({ name: "id_empresa", nullable: true })
  idEmpresa: number;

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

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => Variedad, (variedad) => variedad.cultivo)
  variedades: Variedad[];
}
