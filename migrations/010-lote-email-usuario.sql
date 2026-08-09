-- Gabino Agrogestión - Migración 010
-- "email_usuario" en lote: email del dueño, además del id_usuario.
-- Almacenado denormalizado (igual que nombre_usuario) para mostrarlo sin
-- depender del lookup de Firestore. Los lotes existentes quedan con ''.

ALTER TABLE "lote"
    ADD COLUMN IF NOT EXISTS "email_usuario" VARCHAR(200) NOT NULL DEFAULT '';
