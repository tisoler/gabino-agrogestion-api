-- Gabino Agrogestión - Migración 007
-- Prescripciones de aplicación: una labor + total de ha a aplicar, con uno o
-- varios insumos. La prescripción es inmutable una vez guardada (solo lectura).
--
-- Modelo:
--  * "prescripcion" referencia una campaña (que a su vez tiene lote -> empresa),
--    una labor y el total de hectáreas a aplicar en la fecha indicada.
--  * "prescripcion_insumo" almacena por insumo la cantidad por ha y la cantidad
--    total (total = cantidad_por_ha * total_ha_aplicacion).
--  * Al guardar una prescripción, el backend asigna la labor y los insumos a la
--    campaña (tablas campania_labor / campania_insumo).

CREATE TABLE IF NOT EXISTS "prescripcion" (
    "id"                  SERIAL PRIMARY KEY,
    "fecha"               DATE          NOT NULL DEFAULT CURRENT_DATE,
    "id_campania"         INTEGER       NOT NULL REFERENCES "campania"("id") ON DELETE CASCADE,
    "id_labor"            INTEGER       NOT NULL REFERENCES "labor"("id")    ON DELETE RESTRICT,
    "total_ha_aplicacion" DECIMAL(14,4) NOT NULL,
    "created_at"          TIMESTAMP     NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_prescripcion_campania" ON "prescripcion"("id_campania");
CREATE INDEX IF NOT EXISTS "idx_prescripcion_labor"    ON "prescripcion"("id_labor");
CREATE INDEX IF NOT EXISTS "idx_prescripcion_fecha"    ON "prescripcion"("fecha");

CREATE TABLE IF NOT EXISTS "prescripcion_insumo" (
    "id"              SERIAL PRIMARY KEY,
    "id_prescripcion" INTEGER       NOT NULL REFERENCES "prescripcion"("id") ON DELETE CASCADE,
    "id_insumo"       INTEGER       NOT NULL REFERENCES "insumo"("id")      ON DELETE RESTRICT,
    "cantidad_por_ha" DECIMAL(14,4) NOT NULL,
    "cantidad_total"  DECIMAL(14,4) NOT NULL,
    "created_at"      TIMESTAMP     NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMP     NOT NULL DEFAULT now(),
    CONSTRAINT "uq_prescripcion_insumo" UNIQUE ("id_prescripcion", "id_insumo")
);

CREATE INDEX IF NOT EXISTS "idx_prescripcion_insumo_prescripcion" ON "prescripcion_insumo"("id_prescripcion");
CREATE INDEX IF NOT EXISTS "idx_prescripcion_insumo_insumo"       ON "prescripcion_insumo"("id_insumo");
