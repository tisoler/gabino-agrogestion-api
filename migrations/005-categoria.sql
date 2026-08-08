-- Gabino Agrogestión - Migración 005
-- Entidad "categoria_insumo" (catálogo de categorías de insumos) y columna
-- id_categoria en la tabla "insumo".
--
-- La categoría es SIEMPRE global (no tiene id_empresa): la crean sys-admin o
-- asesor-admin y el resto de roles sólo las seleccionan.

CREATE TABLE IF NOT EXISTS "categoria_insumo" (
    "id"            SERIAL PRIMARY KEY,
    "nombre"        VARCHAR NOT NULL,
    "descripcion"   TEXT,
    "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMP NOT NULL DEFAULT now(),
    "activo"        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_categoria_insumo_nombre"
    ON "categoria_insumo"(LOWER("nombre"))
    WHERE "activo" = true;

ALTER TABLE "insumo"
    ADD COLUMN IF NOT EXISTS "id_categoria" INTEGER REFERENCES "categoria_insumo"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "idx_insumo_categoria" ON "insumo"("id_categoria");
