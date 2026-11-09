-- 039-monitoreo-sin-produccion.sql — Borradores de audio sin lote resuelto.
--
-- Diseño:
--  * `id_campania` pasa a admitir NULL: un borrador generado desde audio
--    libre se guarda igual aunque el lote no se haya resuelto, para que sea
--    visible en la web y resoluble después (móvil: productor → lote →
--    producción). La FK se mantiene (NULL permitido).
--  * Los listados deben contemplar `campania IS NULL` (el scope ya lo hace).

ALTER TABLE "monitoreo_lote"
  ALTER COLUMN "id_campania" DROP NOT NULL;
