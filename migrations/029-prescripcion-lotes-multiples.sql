-- Gabino Agrogestión - Migración 029
-- Una prescripción puede abarcar varios lotes (producciones/campañas) del
-- mismo productor, período y cultivo. La superficie de aplicación se guarda
-- por lote en la nueva tabla "prescripcion_campania".
--
--  * prescripcion.id_campania pasa a ser opcional y se conserva por
--    compatibilidad (apunta a la primera producción de la prescripción).
--  * Las labores/insumos que la prescripción asigna a cada producción
--    (campania_labor / campania_insumo) se replican por campaña con la
--    superficie correspondiente a cada lote.

CREATE TABLE IF NOT EXISTS "prescripcion_campania" (
    "id"                  SERIAL PRIMARY KEY,
    "id_prescripcion"     INTEGER       NOT NULL REFERENCES "prescripcion"("id") ON DELETE CASCADE,
    "id_campania"         INTEGER       NOT NULL REFERENCES "campania"("id")    ON DELETE CASCADE,
    "superficie_aplicada" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "created_at"          TIMESTAMP     NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMP     NOT NULL DEFAULT now(),
    CONSTRAINT "uq_prescripcion_campania" UNIQUE ("id_prescripcion", "id_campania")
);

CREATE INDEX IF NOT EXISTS "idx_prescripcion_campania_prescripcion" ON "prescripcion_campania"("id_prescripcion");
CREATE INDEX IF NOT EXISTS "idx_prescripcion_campania_campania"     ON "prescripcion_campania"("id_campania");

ALTER TABLE "prescripcion"
    ALTER COLUMN "id_campania" DROP NOT NULL;

-- Backfill: las prescripciones existentes pasan a tener un único lote con la
-- superficie que ya tenían en total_ha_aplicacion.
INSERT INTO "prescripcion_campania" ("id_prescripcion", "id_campania", "superficie_aplicada")
SELECT p."id", p."id_campania", p."total_ha_aplicacion"
FROM "prescripcion" p
WHERE p."id_campania" IS NOT NULL
ON CONFLICT ("id_prescripcion", "id_campania") DO NOTHING;
