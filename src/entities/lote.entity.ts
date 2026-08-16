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
import { Campo } from "./campo.entity";

@Entity("lote")
export class Lote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "id_empresa" })
  idEmpresa: number;

  /**
   * UID de Firebase del usuario "dueño" del lote.
   * El usuario vive en Firestore y debe pertenecer a la empresa (id_empresa)
   * vía su campo idEmpresas. No hay FK en la BD.
   */
  @Column({ name: "id_usuario", type: "varchar", length: 128 })
  idUsuario: string;

  /**
   * Nombre del dueño (denormalizado). Se guarda para mostrar el nombre sin
   * depender del lookup de Firestore. Mantener sincronizado con idUsuario.
   */
  @Column({ name: "nombre_usuario", type: "varchar", length: 200, default: "" })
  nombreUsuario: string;

  /**
   * Email del dueño (denormalizado), para la grilla.
   */
  @Column({ name: "email_usuario", type: "varchar", length: 200, default: "" })
  emailUsuario: string;

  @Column({ nullable: true })
  descripcion: string;

  /**
   * Campo: agrupación de lotes (p.ej. establecimiento o parcela).
   * Es un id referenciando la tabla "campo" (como categoría en insumos).
   */
  @Column({ name: "id_campo", type: "int", nullable: true })
  idCampo: number | null;

  @ManyToOne(() => Campo, (campo) => campo.lotes, { nullable: true })
  @JoinColumn({ name: "id_campo" })
  campo: Campo;

  /**
   * Geometría GeoJSON del lote (polígono trazado en el mapa). Opcional.
   */
  @Column({ type: "jsonb", nullable: true })
  geometria: object | null;

  /**
   * Centroide del lote: { lat, lng } (punto central de la geometría).
   */
  @Column({ type: "jsonb", nullable: true })
  centroide: { lat: number; lng: number } | null;

  /**
   * Superficie del lote en ha (informada por el mapa; editable).
   */
  @Column("decimal", { precision: 14, scale: 4, nullable: true })
  area: number | null;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: "id_empresa" })
  empresa: Empresa;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
