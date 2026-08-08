-- Gabino Agrogestión - Migración 008
-- "campo" en lote: texto (requerido) que agrupa los lotes.
--
-- Se agrega la columna con NOT NULL. Como la tabla puede tener filas, se
-- crea con un DEFAULT vacío y se completa en una segunda pasada:
--   1) lotes con descripción → toman "campo" = su descripción;
--   2) lotes sin descripción → quedan con 'Sin campo' para que después se
--      editen desde la app.
-- Correr a mano (aplica una sola vez).

ALTER TABLE "lote"
    ADD COLUMN IF NOT EXISTS "campo" VARCHAR(200) NOT NULL DEFAULT '';

UPDATE "lote"
    SET "campo" = LEFT(TRIM("descripcion"), 200)
    WHERE "campo" = '' AND TRIM(COALESCE("descripcion", '')) <> '';

UPDATE "lote"
    SET "campo" = 'Sin campo'
    WHERE "campo" = '';