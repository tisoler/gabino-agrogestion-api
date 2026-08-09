-- Gabino Agrogestión - Migración 012
-- "superficie_aplicada" en campania_insumo: superficie (ha) donde se aplicó el
-- insumo. Se usa para el "Costo ponderado/ha" (igual que labores). Cuando se
-- guarda una prescripción, se setea con la superficie de la prescripción.
-- Los registros existentes quedan en 0.

ALTER TABLE "campania_insumo"
    ADD COLUMN IF NOT EXISTS "superficie_aplicada" NUMERIC(14,4) NOT NULL DEFAULT 0;
