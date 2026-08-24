-- Gabino Agrogestión - Migración 026
-- Observaciones opcionales por costo vario (campania_costo).

ALTER TABLE "campania_costo"
    ADD COLUMN IF NOT EXISTS "observaciones" TEXT;