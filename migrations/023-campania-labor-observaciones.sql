-- Gabino Agrogestión - Migración 023
-- Observaciones por labor: texto libre (p.ej. quién realizó la labor).

ALTER TABLE "campania_labor"
    ADD COLUMN IF NOT EXISTS "observaciones" TEXT;
