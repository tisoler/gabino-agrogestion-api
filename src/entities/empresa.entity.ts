import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ValueTransformer,
} from "typeorm";
import { capitalizarNombre } from "../utils/nombre";

/**
 * El nombre se normaliza al leer de BD (no al escribir) para que todas las
 * vistas que muestran el productor —/empresas, campañas, prescripciones,
 * PDF— lo vean igual, sin importar cómo se tipeó en su momento.
 */
const nombrePropioTransformer: ValueTransformer = {
  to: (value: string | null | undefined) => value ?? null,
  from: (value: string | null) => capitalizarNombre(value),
};

@Entity("empresa")
export class Empresa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ transformer: nombrePropioTransformer })
  nombre: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ default: true })
  activo: boolean;
}
