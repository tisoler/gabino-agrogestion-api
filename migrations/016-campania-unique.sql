-- Gabino Agrogestión - Migración 016
-- Evita dos producciones activas con el mismo lote + campaña (período) + cultivo.
-- El lote ya determina el productor (empresa), por eso no hace falta incluirlo.
--
-- Índice único parcial (solo activas): permite re-crear una producción si la
-- anterior fue desactivada (borrado lógico).
--
-- NOTA: si ya existen producciones duplicadas, el CREATE falla; limpiá los
-- duplicados antes de correrlo.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_campania_lote_periodo_cultivo"
    ON "campania"("id_lote", "campania", "id_cultivo")
    WHERE "activo" = true;
