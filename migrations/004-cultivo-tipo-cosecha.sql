-- Gabino Agrogestión - Migración 004
-- Campo "tipo_cosecha" en la tabla cultivo.
--
-- Valores posibles: 'fina' | 'gruesa'. Se permite NULL para no romper los
-- cultivos existentes; la API/UI lo tratan como opcional.
--
--   * 'fina'   -> cosecha fina
--   * 'gruesa' -> cosecha gruesa

ALTER TABLE "cultivo"
    ADD COLUMN IF NOT EXISTS "tipo_cosecha" VARCHAR(10)
        CHECK ("tipo_cosecha" IN ('fina', 'gruesa'));
