-- 035-prescripcion-numero-productor.sql — Numeración de prescripción por
-- productor (E-AA-N, ej. 12-26-104), igual que producciones.
--
-- Diseño (reemplaza al modelo por asesor de la 032, eliminada sin haberse
-- aplicado; los DROP IF EXISTS cubren por si llegó a aplicarse):
--  * El ámbito es el productor (`num_empresa`: toda prescripción abarca lotes
--    de un solo productor) y el año son los últimos 2 dígitos de `fecha`.
--    No importa qué asesor la genera: la correlativa es del productor y
--    reinicia cada año.
--  * Se reutiliza `numero` (conserva el id como secuencial: las ya compartidas
--    mantienen su número, ahora con prefijo E-AA).

ALTER TABLE "prescripcion" DROP COLUMN IF EXISTS "uid_asesor";

DROP INDEX IF EXISTS "uq_prescripcion_anio_numero";
DROP INDEX IF EXISTS "uq_prescripcion_asesor_anio_numero";

ALTER TABLE "prescripcion" ADD COLUMN IF NOT EXISTS "num_empresa" INTEGER;
ALTER TABLE "prescripcion" ADD COLUMN IF NOT EXISTS "num_anio" INTEGER;

-- Backfill del ámbito: empresa del lote principal o del primer lote, y año
-- de la fecha en 2 dígitos. Toda prescripción tiene al menos un lote (el
-- create lo exige), así que no debería quedar ninguna sin ámbito.
WITH ambito AS (
  SELECT p."id" AS pid,
         COALESCE(l1."id_empresa", l2."id_empresa") AS emp,
         ((EXTRACT(YEAR FROM p."fecha"))::int % 100) AS anio
  FROM "prescripcion" p
  LEFT JOIN "campania" c1 ON c1."id" = p."id_campania"
  LEFT JOIN "lote" l1 ON l1."id" = c1."id_lote"
  LEFT JOIN LATERAL (
    SELECT c."id_lote" AS id_lote
    FROM "prescripcion_campania" pc
    JOIN "campania" c ON c."id" = pc."id_campania"
    WHERE pc."id_prescripcion" = p."id"
    ORDER BY pc."id" ASC
    LIMIT 1
  ) pl ON true
  LEFT JOIN "lote" l2 ON l2."id" = pl."id_lote"
)
UPDATE "prescripcion" p
SET "num_empresa" = a.emp, "num_anio" = a.anio
FROM ambito a WHERE a.pid = p.id;

ALTER TABLE "prescripcion" ALTER COLUMN "num_empresa" SET NOT NULL;
ALTER TABLE "prescripcion" ALTER COLUMN "num_anio" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_prescripcion_numero"
  ON "prescripcion" ("num_empresa", "num_anio", "numero");
