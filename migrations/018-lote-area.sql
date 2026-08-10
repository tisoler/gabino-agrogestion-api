-- Gabino Agrogestión - Migración 018
-- "area" en lote: superficie del lote en ha. La informa el mapa al dibujar el
-- polígono, pero es editable. Opcional (NULL).

ALTER TABLE "lote"
    ADD COLUMN IF NOT EXISTS "area" NUMERIC(14,4);
