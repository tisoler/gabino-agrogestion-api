import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export type TipoNotificacion = 'produccion' | 'prescripcion';

/**
 * Notificación para un usuario (dueño de lote) cuando un asesor/asesor-admin
 * genera una producción o prescripción para uno de sus lotes.
 *
 * `idUsuario` es el UID de Firebase del destinatario. El vínculo a la pantalla
 * se resuelve por `idCampania` (producción) o `idPrescripcion` (prescripción).
 */
@Entity('notificacion')
export class Notificacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_usuario', type: 'varchar', length: 128 })
  idUsuario: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: TipoNotificacion;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ name: 'id_campania', type: 'int', nullable: true })
  idCampania: number | null;

  @Column({ name: 'id_prescripcion', type: 'int', nullable: true })
  idPrescripcion: number | null;

  @Column({ default: false })
  leida: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
