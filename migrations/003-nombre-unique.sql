-- Gabino Agrogestión - Migración 003
-- Unicidad de nombre case-insensitive en Labor / Insumo / Costo / Cultivo.
--
-- Reglas de negocio (validadas en la capa de servicio):
--   * Global con nombre X: bloquea cualquier item con nombre X (global o de
--     cualquier empresa).
--   * Empresa A con nombre X: bloquea items con nombre X en la misma empresa
--     o como global; NO bloquea otras empresas.
--
-- En PostgreSQL, los NULL en columnas de un índice único se tratan como
-- distintos entre sí, por lo que un índice UNIQUE(id_empresa, LOWER(nombre))
-- no cubre el caso "global vs empresa" — eso se valida en el servicio.
-- Este índice cubre la unicidad por empresa (incluyendo el caso "dos globales
-- con el mismo nombre") como red de seguridad ante condiciones de carrera.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_labor_empresa_nombre"
    ON "labor"("id_empresa", LOWER("nombre"))
    WHERE "activo" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_insumo_empresa_nombre"
    ON "insumo"("id_empresa", LOWER("nombre"))
    WHERE "activo" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_costo_empresa_nombre"
    ON "costo"("id_empresa", LOWER("nombre"))
    WHERE "activo" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_cultivo_empresa_nombre"
    ON "cultivo"("id_empresa", LOWER("nombre"))
    WHERE "activo" = true;
