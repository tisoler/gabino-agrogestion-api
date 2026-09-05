-- Gabino Agrogestión - Migración 028
-- Observaciones opcionales en la prescripción (indicaciones sobre la labor).

ALTER TABLE "prescripcion"
    ADD COLUMN IF NOT EXISTS "observaciones" TEXT;
