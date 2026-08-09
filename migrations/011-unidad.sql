-- Gabino Agrogestión - Migración 011
-- "unidad" en insumo y costo: unidad de medida del precio.
-- Valores permitidos: ton, kg, lt, unidad, ha, hr. Opcional (NULL = sin unidad).

ALTER TABLE "insumo"
    ADD COLUMN IF NOT EXISTS "unidad" VARCHAR(20);

ALTER TABLE "costo"
    ADD COLUMN IF NOT EXISTS "unidad" VARCHAR(20);
