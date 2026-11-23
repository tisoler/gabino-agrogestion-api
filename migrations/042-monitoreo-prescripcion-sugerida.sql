-- 040-monitoreo-prescripcion-sugerida.sql — Líneas de prescripción sugeridas por voz.
--
-- Diseño (prueba):
--  * `prescripcion_sugerida` guarda el JSON que el parser de voz extrajo
--    ([{ idInsumo|null, nombre, cantidadPorHa|null, unidad|null }]) cuando el
--    audio menciona prescribir/aplicar. No crea prescripción: la web la revisa
--    (corrige/agrega/quita líneas) y al guardar crea la prescripción real
--    (independiente) o la descarta (PATCH null).
--  * Sin FK ni constraint: los insumos pueden renombrarse; la revisión web
--    resuelve el idInsumo definitivo.

ALTER TABLE "monitoreo_lote"
  ADD COLUMN IF NOT EXISTS "prescripcion_sugerida" JSONB;
