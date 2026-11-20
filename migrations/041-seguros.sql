-- Gabino Agrogestión - Migración 041
-- Datos para seguros: fecha de siembra + aseguradora y qq asegurados por
-- producción, y tabla de empresas de seguros (admin: La Dulce, La Segunda).

-- ---------------------------------------------------------------------------
-- 1) Tabla "aseguradora"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "aseguradora" (
    "id"            SERIAL PRIMARY KEY,
    "nombre"        VARCHAR(200) NOT NULL UNIQUE,
    "activo"        BOOLEAN NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO "aseguradora" ("nombre") VALUES ('La Dulce'), ('La Segunda')
ON CONFLICT ("nombre") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Columnas en "campania"
-- ---------------------------------------------------------------------------
ALTER TABLE "campania"
    ADD COLUMN IF NOT EXISTS "fecha_siembra" DATE,
    ADD COLUMN IF NOT EXISTS "id_aseguradora" INTEGER REFERENCES "aseguradora"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "qq_asegurados" DECIMAL(14,4);

CREATE INDEX IF NOT EXISTS "idx_campania_aseguradora" ON "campania"("id_aseguradora");

-- ---------------------------------------------------------------------------
-- 3) Backfill de fecha_siembra: fecha mínima de las labores de siembra
--    cargadas en cada producción (matcheo por contenido para cubrir las
--    variantes "Siembra grano fino", "Siembra grano grueso", etc.).
-- ---------------------------------------------------------------------------
UPDATE "campania" c
SET "fecha_siembra" = sub.min_fecha
FROM (
    SELECT cl."id_campania" AS id_campania, MIN(cl."fecha") AS min_fecha
    FROM "campania_labor" cl
    JOIN "labor" l ON l."id" = cl."id_labor"
    WHERE l."nombre" ILIKE '%siembra%'
    GROUP BY cl."id_campania"
) sub
WHERE c."id" = sub.id_campania
  AND c."fecha_siembra" IS NULL;
