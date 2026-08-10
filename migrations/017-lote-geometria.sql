-- Gabino Agrogestión - Migración 017
-- En lote se reemplazan lat/long por "geometria" (polígono GeoJSON trazado en el
-- mapa) y "centroide" (punto central { lat, lng }).
-- El centroide se backfillea desde las lat/long existentes; la geometría queda
-- NULL hasta que se trace el lote en el mapa.

ALTER TABLE "lote"
    ADD COLUMN IF NOT EXISTS "geometria" JSONB;

ALTER TABLE "lote"
    ADD COLUMN IF NOT EXISTS "centroide" JSONB;

UPDATE "lote"
SET "centroide" = jsonb_build_object('lat', "lat", 'lng', "long")
WHERE "centroide" IS NULL AND "lat" IS NOT NULL AND "long" IS NOT NULL;

ALTER TABLE "lote" DROP COLUMN IF EXISTS "lat";
ALTER TABLE "lote" DROP COLUMN IF EXISTS "long";
