-- Gabino Agrogestión - Migración 006
-- Precio unitario (de referencia) en Labor, Insumo y Costo.
--
-- Es un valor guiador que se precarga en el detalle de la campaña cuando se
-- selecciona el ítem, pero siempre se puede editar en el detalle.

ALTER TABLE "labor"
    ADD COLUMN IF NOT EXISTS "precio_unitario" DECIMAL(14,4);

ALTER TABLE "insumo"
    ADD COLUMN IF NOT EXISTS "precio_unitario" DECIMAL(14,4);

ALTER TABLE "costo"
    ADD COLUMN IF NOT EXISTS "precio_unitario" DECIMAL(14,4);