-- Gabino Agrogestión - Migración 022
-- Elimina el campo "nombre" de "campania" (producción).
--
-- El identificador de una producción queda definido por su combinación
-- lote + campaña (período) + cultivo, que ya es única entre producciones
-- activas (índice uq_campania_lote_periodo_cultivo). El campo "nombre" se
-- usaba solo como etiqueta en el FE y ya no se necesita.

ALTER TABLE "campania" DROP COLUMN IF EXISTS "nombre";
