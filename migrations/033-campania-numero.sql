-- 033-campania-numero.sql — Número de producción E-AA-N (5-26-7).
--
-- Diseño:
--  * El ámbito es el productor (`num_empresa`, snapshot del lote al crear) y
--    el año son los últimos 2 dígitos del año de creación (`num_anio`, ej. 26).
--    No importa quién la genere (asesor, productor o sys-admin).
--  * `num_seq` reinicia por (empresa, año). El número es inmutable: si la
--    producción se mueve de lote/empresa, conserva el original.

ALTER TABLE "campania" ADD COLUMN IF NOT EXISTS "num_empresa" INTEGER;
ALTER TABLE "campania" ADD COLUMN IF NOT EXISTS "num_anio" INTEGER;
ALTER TABLE "campania" ADD COLUMN IF NOT EXISTS "num_seq" INTEGER;

-- Backfill: secuencial por (empresa del lote, año de creación en 2 dígitos),
-- ordenado por (created_at, id).
WITH ordenadas AS (
  SELECT c."id",
         l."id_empresa" AS emp,
         ((EXTRACT(YEAR FROM c."created_at"))::int % 100) AS anio,
         ROW_NUMBER() OVER (
           PARTITION BY l."id_empresa", ((EXTRACT(YEAR FROM c."created_at"))::int % 100)
           ORDER BY c."created_at", c."id"
         ) AS seq
  FROM "campania" c
  JOIN "lote" l ON l."id" = c."id_lote"
)
UPDATE "campania" c
SET "num_empresa" = o.emp, "num_anio" = o.anio, "num_seq" = o.seq
FROM ordenadas o WHERE o.id = c.id;

ALTER TABLE "campania" ALTER COLUMN "num_empresa" SET NOT NULL;
ALTER TABLE "campania" ALTER COLUMN "num_anio" SET NOT NULL;
ALTER TABLE "campania" ALTER COLUMN "num_seq" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_campania_numero"
  ON "campania" ("num_empresa", "num_anio", "num_seq");
