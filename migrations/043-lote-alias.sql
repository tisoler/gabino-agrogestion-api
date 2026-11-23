-- 041-lote-alias.sql — Nombres alternativos del lote (para voz).
--
-- Diseño:
--  * `alias` JSONB: lista de nombres alternativos ("como lo llama el asesor").
--    Participan en el matcheo por voz junto a la descripción, en servidor
--    (rankearLotes) y móvil (Fuse). Sin FK ni constraints: si varios lotes
--    empatan, resuelve la persona ordenados por puntaje.

ALTER TABLE "lote"
  ADD COLUMN IF NOT EXISTS "alias" JSONB;
