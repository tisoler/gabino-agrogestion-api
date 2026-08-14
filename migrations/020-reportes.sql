-- Gabino Agrogestión - Migración 020
-- Reportes: Resumen Campaña y Detalle de Asesoramiento.
--
-- Modelo:
--  * "reporte" es la cabecera: productor (id_empresa), período de campaña,
--    tipo ('resumen_campania' | 'detalle_asesoramiento'), y para detalle el
--    tipo de cosecha, el % de asesoramiento general y si aplica IVA (21%).
--  * "reporte_fila" guarda la referencia a la/s producción/es (campaña):
--      - resumen: id_lote + id_produccion_fina / id_produccion_gruesa.
--      - detalle: id_lote + id_produccion + porcentaje_asesoramiento.
--    Los valores calculados (márgenes, totales de asesoramiento) se resuelven
--    al presentar, porque la producción puede modificarse después.

DROP TABLE IF EXISTS "reporte_fila";
DROP TABLE IF EXISTS "reporte";

CREATE TABLE "reporte" (
    "id"                        SERIAL PRIMARY KEY,
    "id_empresa"                INTEGER       NOT NULL REFERENCES "empresa"("id") ON DELETE RESTRICT,
    "campania"                  VARCHAR(7)    NOT NULL,
    "tipo"                      VARCHAR(30)   NOT NULL,
    "tipo_cosecha"              VARCHAR(10),
    "asesoramiento_porcentaje"  DECIMAL(10,6),
    "aplica_iva"                BOOLEAN       NOT NULL DEFAULT false,
    "activo"                    BOOLEAN       NOT NULL DEFAULT true,
    "created_at"                TIMESTAMP     NOT NULL DEFAULT now(),
    "updated_at"                TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX "idx_reporte_empresa"     ON "reporte"("id_empresa");
CREATE INDEX "idx_reporte_campania"    ON "reporte"("campania");
CREATE INDEX "idx_reporte_tipo"        ON "reporte"("tipo");

CREATE TABLE "reporte_fila" (
    "id"                         SERIAL PRIMARY KEY,
    "id_reporte"                 INTEGER       NOT NULL REFERENCES "reporte"("id") ON DELETE CASCADE,
    "id_lote"                    INTEGER       NOT NULL REFERENCES "lote"("id")    ON DELETE RESTRICT,
    "id_produccion"              INTEGER       REFERENCES "campania"("id")         ON DELETE RESTRICT,
    "id_produccion_fina"         INTEGER       REFERENCES "campania"("id")         ON DELETE RESTRICT,
    "id_produccion_gruesa"       INTEGER       REFERENCES "campania"("id")         ON DELETE RESTRICT,
    "porcentaje_asesoramiento"   DECIMAL(10,6),
    "created_at"                 TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX "idx_reporte_fila_reporte" ON "reporte_fila"("id_reporte");
