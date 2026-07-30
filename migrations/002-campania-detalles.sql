-- Gabino Agrogestión - Migración 002
-- Vista Campaña: cabecera extendida y tablas de detalle (labores, insumos, costos varios)
-- aplicados a un lote dentro de una campaña agrícola.
--
-- Convenciones:
--  * Una campaña (cabecera) pertenece siempre a un lote.
--  * Los ítems "tipo" de Labor / Insumo / Costo referenciados desde los detalles
--    pueden ser globales (id_empresa IS NULL) o de la empresa del lote. El
--    servicio valida que el idEmpresa del item coincida con el de la campaña.
--  * Los valores por-ha que se muestran en la UI se derivan en el momento a
--    partir de estos datos (no se persisten totales).
--  * Los campos numéricos se almacenan como DECIMAL(14,4) para cubrir qq/ha,
--    qq, $/qq, % y has con buen margen.

-- ---------------------------------------------------------------------------
-- 1) Ampliar la tabla "campania" con la cabecera de la planilla
-- ---------------------------------------------------------------------------
ALTER TABLE "campania"
    ADD COLUMN IF NOT EXISTS "id_lote"             INTEGER     REFERENCES "lote"("id")     ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS "id_cultivo"          INTEGER     REFERENCES "cultivo"("id")  ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS "id_variedad"         INTEGER     REFERENCES "variedad"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "sup_sembrada"         DECIMAL(14,4),
    ADD COLUMN IF NOT EXISTS "sup_cosechada"        DECIMAL(14,4),
    ADD COLUMN IF NOT EXISTS "prod_neta_total_qq"  DECIMAL(14,4),
    ADD COLUMN IF NOT EXISTS "precio_x_qq"         DECIMAL(14,4),
    ADD COLUMN IF NOT EXISTS "alquiler_qq_ha"      DECIMAL(14,4),
    ADD COLUMN IF NOT EXISTS "comercializacion_pct" DECIMAL(7,4),
    ADD COLUMN IF NOT EXISTS "cosecha_x_ha"        DECIMAL(14,4);

CREATE INDEX IF NOT EXISTS "idx_campania_lote"     ON "campania"("id_lote");
CREATE INDEX IF NOT EXISTS "idx_campania_cultivo"  ON "campania"("id_cultivo");
CREATE INDEX IF NOT EXISTS "idx_campania_variedad" ON "campania"("id_variedad");
CREATE INDEX IF NOT EXISTS "idx_campania_anios"    ON "campania"("anio_desde", "anio_hasta");

-- ---------------------------------------------------------------------------
-- 2) Tabla "campania_labor": laboreos aplicados en la campaña
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "campania_labor" (
    "id"                    SERIAL PRIMARY KEY,
    "id_campania"           INTEGER     NOT NULL REFERENCES "campania"("id") ON DELETE CASCADE,
    "id_labor"              INTEGER     NOT NULL REFERENCES "labor"("id")    ON DELETE RESTRICT,
    "fecha"                 DATE        NOT NULL DEFAULT CURRENT_DATE,
    "superficie_laboreada"  DECIMAL(14,4) NOT NULL,
    "costo_labor_ha"        DECIMAL(14,4) NOT NULL,
    "created_at"            TIMESTAMP   NOT NULL DEFAULT now(),
    "updated_at"            TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_campania_labor_campania" ON "campania_labor"("id_campania");
CREATE INDEX IF NOT EXISTS "idx_campania_labor_labor"    ON "campania_labor"("id_labor");
CREATE INDEX IF NOT EXISTS "idx_campania_labor_fecha"    ON "campania_labor"("fecha");

-- ---------------------------------------------------------------------------
-- 3) Tabla "campania_insumo": insumos aplicados en la campaña
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "campania_insumo" (
    "id"            SERIAL PRIMARY KEY,
    "id_campania"   INTEGER       NOT NULL REFERENCES "campania"("id") ON DELETE CASCADE,
    "id_insumo"     INTEGER       NOT NULL REFERENCES "insumo"("id")   ON DELETE RESTRICT,
    "unidades_ha"   DECIMAL(14,4) NOT NULL,
    "costo_unidad"  DECIMAL(14,4) NOT NULL,
    "created_at"    TIMESTAMP     NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_campania_insumo_campania" ON "campania_insumo"("id_campania");
CREATE INDEX IF NOT EXISTS "idx_campania_insumo_insumo"   ON "campania_insumo"("id_insumo");

-- ---------------------------------------------------------------------------
-- 4) Tabla "campania_costo": costos varios aplicados en la campaña
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "campania_costo" (
    "id"            SERIAL PRIMARY KEY,
    "id_campania"   INTEGER       NOT NULL REFERENCES "campania"("id") ON DELETE CASCADE,
    "id_costo"      INTEGER       NOT NULL REFERENCES "costo"("id")    ON DELETE RESTRICT,
    "unidades_ha"   DECIMAL(14,4) NOT NULL,
    "costo_unidad"  DECIMAL(14,4) NOT NULL,
    "created_at"    TIMESTAMP     NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_campania_costo_campania" ON "campania_costo"("id_campania");
CREATE INDEX IF NOT EXISTS "idx_campania_costo_costo"    ON "campania_costo"("id_costo");
