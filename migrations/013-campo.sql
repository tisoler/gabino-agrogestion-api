-- Gabino Agrogestión - Migración 013
-- "campo" de lote pasa de texto a id (tabla "campo", como categoría de insumos).
--
--   1) Crea la tabla "campo".
--   2) Backfill: un campo por cada nombre distinto existente en "lote".
--   3) Agrega "id_campo" a "lote" y lo completa según el nombre.
--   4) Agrega FK, índice y quita la columna "campo" (string).
--
-- Correr a mano (aplica una sola vez). Los lotes sin campo quedan con NULL.

CREATE TABLE IF NOT EXISTS "campo" (
    "id"            SERIAL PRIMARY KEY,
    "nombre"        VARCHAR NOT NULL,
    "descripcion"   TEXT,
    "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMP NOT NULL DEFAULT now(),
    "activo"        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_campo_nombre"
    ON "campo"(LOWER("nombre"))
    WHERE "activo" = true;

ALTER TABLE "lote"
    ADD COLUMN IF NOT EXISTS "id_campo" INTEGER;

INSERT INTO "campo" ("nombre")
SELECT DISTINCT "campo" FROM "lote"
WHERE TRIM(COALESCE("campo", '')) <> ''
ON CONFLICT DO NOTHING;

UPDATE "lote" SET "id_campo" = c.id
FROM "campo" c
WHERE "lote"."campo" = c."nombre";

ALTER TABLE "lote"
    ADD CONSTRAINT "fk_lote_campo" FOREIGN KEY ("id_campo") REFERENCES "campo"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "idx_lote_campo" ON "lote"("id_campo");

ALTER TABLE "lote" DROP COLUMN IF EXISTS "campo";
