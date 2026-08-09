-- Gabino Agrogestión - Migración 014
-- "campo" se asocia a una empresa (igual que lote).
--
--   1) Agrega "id_empresa" a "campo".
--   2) Backfill: toma la empresa de los lotes que referencian cada campo
--      (los campos creados por la migración 013 siempre tienen lote).
--   3) Agrega FK e índice. La columna queda nullable por compatibilidad.

ALTER TABLE "campo"
    ADD COLUMN IF NOT EXISTS "id_empresa" INTEGER;

UPDATE "campo" c
SET "id_empresa" = sub."id_empresa"
FROM (
    SELECT "id_campo", MIN("id_empresa") AS "id_empresa"
    FROM "lote"
    WHERE "id_campo" IS NOT NULL
    GROUP BY "id_campo"
) sub
WHERE c."id" = sub."id_campo" AND c."id_empresa" IS NULL;

ALTER TABLE "campo"
    ADD CONSTRAINT "fk_campo_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "idx_campo_empresa" ON "campo"("id_empresa");
