-- Gabino Agrogestión - Migración 021
-- Anulación de prescripciones (borrado lógico).
--
-- Modelo:
--  * "prescripcion"."anulada" (BOOLEAN, default false) indica si la
--    prescripción fue anulada. No se elimina: se puede recuperar.

ALTER TABLE "prescripcion"
    ADD COLUMN IF NOT EXISTS "anulada" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_prescripcion_anulada" ON "prescripcion"("anulada");
