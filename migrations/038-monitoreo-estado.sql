-- 038-monitoreo-estado.sql — Estados borrador/confirmado + origen audio (spikes voz).
--
-- Diseño:
--  * `estado`: 'borrador' (generado desde audio, pendiente de revisión) o
--    'confirmado' (flujo normal). Los registros existentes quedan confirmados.
--  * `origen`: cómo se creó ('manual' | 'audio_libre' | 'audio_lote'). NULL en
--    filas viejas = manual implícito.
--  * `transcripcion_estado`: ciclo del audio ('pendiente' | 'procesando' |
--    'a_revisar' | 'ok'). NULL cuando no hay audio involucrado.
--  * `audio_url`: URL pública del audio en Spaces (re-escucha en revisión).
--    Se limpia al confirmar el monitoreo.

ALTER TABLE "monitoreo_lote"
  ADD COLUMN IF NOT EXISTS "estado" VARCHAR(16) NOT NULL DEFAULT 'confirmado',
  ADD COLUMN IF NOT EXISTS "origen" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "transcripcion_estado" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "audio_url" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_monitoreo_lote_estado'
  ) THEN
    ALTER TABLE "monitoreo_lote"
      ADD CONSTRAINT "chk_monitoreo_lote_estado"
      CHECK ("estado" IN ('borrador', 'confirmado'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_monitoreo_lote_origen'
  ) THEN
    ALTER TABLE "monitoreo_lote"
      ADD CONSTRAINT "chk_monitoreo_lote_origen"
      CHECK ("origen" IS NULL OR "origen" IN ('manual', 'audio_libre', 'audio_lote'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ix_monitoreo_lote_estado"
  ON "monitoreo_lote" ("estado");
