-- 032-prescripcion-asesor.sql — Numeración de prescripción por asesor y año
-- (año-numero por cada asesor, ej. 26-104).
--
-- Diseño:
--  * `uid_asesor` es el UID de Firebase del asesor dueño de la correlativa.
--    NULL = legado (anterior al modelo por asesor), se muestra igual.
--  * `numero` se reutiliza como secuencial dentro de (asesor, año).
--  * El índice global por año de la 031 impediría repetir número entre
--    asesores, así que se reemplaza por uno parcial por (asesor, año, numero).

ALTER TABLE "prescripcion" ADD COLUMN IF NOT EXISTS "uid_asesor" VARCHAR(128);

-- Backfill: todas las existentes se asignan al asesor actual (su número,
-- que conserva el id, pasa a ser de su correlativa).
UPDATE "prescripcion"
SET "uid_asesor" = 'd2ZEbZXPctSmX9s19vrkKkZF2TZ2'
WHERE "uid_asesor" IS NULL;

DROP INDEX IF EXISTS "uq_prescripcion_anio_numero";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_prescripcion_asesor_anio_numero"
  ON "prescripcion" ("uid_asesor", ((EXTRACT(YEAR FROM "fecha"))::int), "numero")
  WHERE "uid_asesor" IS NOT NULL;
