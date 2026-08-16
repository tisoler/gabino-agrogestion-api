-- Gabino Agrogestión - Migración 024
-- Vincula las filas de labor e insumo de una producción con la prescripción
-- que las originó, para agruparlas visualmente con un color común.

ALTER TABLE "campania_labor"
    ADD COLUMN IF NOT EXISTS "id_prescripcion" INTEGER REFERENCES "prescripcion"("id") ON DELETE SET NULL;

ALTER TABLE "campania_insumo"
    ADD COLUMN IF NOT EXISTS "id_prescripcion" INTEGER REFERENCES "prescripcion"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_campania_labor_prescripcion"   ON "campania_labor"("id_prescripcion");
CREATE INDEX IF NOT EXISTS "idx_campania_insumo_prescripcion"  ON "campania_insumo"("id_prescripcion");
