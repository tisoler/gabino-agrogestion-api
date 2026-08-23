-- Gabino Agrogestión - Migración 025
-- Mensajes masivos de WhatsApp: historial de envíos.
--
-- Convenciones:
--  * Registro de sólo lectura (append-only): la UI no permite editar ni
--    eliminar, por eso no hay updated_at ni activo.
--  * El emisor es un usuario de Firestore (no existe en la BD); se
--    denormalizan email y nombre para mostrarlos sin lookup.
--  * Los destinatarios se guardan como arrays de texto (teléfonos en
--    formato internacional y emails) porque son un snapshot del envío:
--    los celulares pueden cambiar en el tiempo sin alterar el historial.

CREATE TABLE IF NOT EXISTS "mensaje_masivo" (
    "id" SERIAL PRIMARY KEY,
    "mensaje" TEXT NOT NULL,
    "fecha" TIMESTAMP NOT NULL DEFAULT now(),
    "id_usuario_emisor" VARCHAR(128) NOT NULL,
    "email_emisor" VARCHAR,
    "nombre_emisor" VARCHAR,
    "campania" VARCHAR NOT NULL,
    "id_cultivo" INTEGER REFERENCES "cultivo"("id") ON DELETE SET NULL,
    "telefonos_destino" TEXT[] NOT NULL,
    "emails_destino" TEXT[] NOT NULL
);
