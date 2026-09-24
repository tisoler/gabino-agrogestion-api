-- 031-prescripcion-numero.sql — Número de prescripción con forma año-número
-- (26-1, 26-104).
--
-- Diseño:
--  * El año se deriva de `fecha` (sin columna extra) y `numero` es el
--    secuencial dentro de ese año (arranca en 1 cada año).
--  * `numero` admite valores iguales entre años distintos; la unicidad es por
--    (año, numero) vía índice único por expresión.

ALTER TABLE "prescripcion" ADD COLUMN IF NOT EXISTS "numero" INTEGER;

-- Backfill: se conserva el id como número (hasta hoy el número visible era
-- el id y varias prescripciones ya se compartieron con ese valor). El número
-- visible pasa a ser año-id (26-104); los nuevos arrancan desde MAX+1 del año.
UPDATE "prescripcion" SET "numero" = "id" WHERE "numero" IS NULL;

ALTER TABLE "prescripcion" ALTER COLUMN "numero" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_prescripcion_anio_numero"
  ON "prescripcion" (((EXTRACT(YEAR FROM "fecha"))::int), "numero");
