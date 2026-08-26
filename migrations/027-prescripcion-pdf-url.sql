-- Gabino Agrogestión - Migración 027
-- Guarda la URL del PDF generado para compartir (WhatsApp) en la prescripción,
-- para no regenerarlo en cada compartido. Es opcional y se puede limpiar
-- (NULL) cuando se elimine el PDF del storage.

ALTER TABLE "prescripcion"
    ADD COLUMN IF NOT EXISTS "pdf_url" VARCHAR(1000);
