-- Gabino Agrogestión - Migración 009
-- "nombre_usuario" en lote: nombre del dueño, además del id_usuario.
-- Se almacena denormalizado para mostrar el nombre sin depender del lookup
-- de Firestore. Los lotes existentes quedan con '' (el FE los muestra por
-- lookup hasta que se vuelvan a guardar).

ALTER TABLE "lote"
    ADD COLUMN IF NOT EXISTS "nombre_usuario" VARCHAR(200) NOT NULL DEFAULT '';
