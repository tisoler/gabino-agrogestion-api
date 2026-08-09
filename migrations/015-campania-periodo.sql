-- Gabino Agrogestión - Migración 015
-- Reemplaza anio_desde/anio_hasta de "campania" por un único campo "campania"
-- con el período (ej: "25/26").
--
--   1) Agrega la columna "campania".
--   2) Backfill: arma el período con dos dígitos de cada año (ej: 2025/2026 -> 25/26).
--   3) Fija NOT NULL y quita las columnas viejas.

ALTER TABLE "campania"
    ADD COLUMN IF NOT EXISTS "campania" VARCHAR(7);

UPDATE "campania"
SET "campania" = LPAD((COALESCE(anio_desde, 2025) % 100)::text, 2, '0')
             || '/' || LPAD((COALESCE(anio_hasta, 2026) % 100)::text, 2, '0')
WHERE "campania" IS NULL;

ALTER TABLE "campania"
    ALTER COLUMN "campania" SET NOT NULL;

ALTER TABLE "campania" DROP COLUMN IF EXISTS "anio_desde";
ALTER TABLE "campania" DROP COLUMN IF EXISTS "anio_hasta";
