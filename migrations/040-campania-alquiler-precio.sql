-- Gabino Agrogestión - Migración 040
-- Precio del quintal para el alquiler ($/qq). Si es NULL se usa el precio
-- de venta (precio_x_qq) o la pizarra como referencia visual en el FE.

ALTER TABLE "campania"
    ADD COLUMN IF NOT EXISTS "alquiler_precio_x_qq" decimal(14,4);
