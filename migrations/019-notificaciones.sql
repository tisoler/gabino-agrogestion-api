-- Gabino Agrogestión - Migración 019
-- Notificaciones: avisos al dueño de un lote cuando un asesor/asesor-admin
-- genera una producción (campaña) o prescripción para uno de sus lotes.
--
-- Modelo:
--  * "notificacion" apunta al UID de Firebase del destinatario (id_usuario;
--    el usuario vive en Firestore, no hay FK).
--  * tipo: 'produccion' | 'prescripcion'.
--  * El link se resuelve por id_campania (producción) o id_prescripcion.
--  * "leida" permite marcar las notificaciones como leídas.

CREATE TABLE IF NOT EXISTS "notificacion" (
    "id"              SERIAL PRIMARY KEY,
    "id_usuario"      VARCHAR(128) NOT NULL,
    "tipo"            VARCHAR(30)  NOT NULL,
    "mensaje"         TEXT         NOT NULL,
    "id_campania"     INTEGER,
    "id_prescripcion" INTEGER,
    "leida"           BOOLEAN      NOT NULL DEFAULT false,
    "created_at"      TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_notificacion_usuario" ON "notificacion"("id_usuario");
CREATE INDEX IF NOT EXISTS "idx_notificacion_usuario_leida" ON "notificacion"("id_usuario", "leida");
