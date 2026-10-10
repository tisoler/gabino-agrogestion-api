-- 036-analisis-suelo.sql — Análisis de suelo por lote.
--
-- Diseño:
--  * `analisis_suelo`: una cabecera por informe (varios por lote, por fecha y
--    profundidad). Sin constraint de unicidad: se permite más de uno.
--  * `analisis_suelo_detalle`: una fila por determinación medida
--    (parámetro normalizado + valor numérico o texto + unidad). Las filas del
--    informe sin valor no generan detalle.
--  * El archivo original NO se guarda (decisión de producto): se extrae,
--    se previsualiza y el usuario acepta/ajusta antes de guardar.

CREATE TABLE IF NOT EXISTS "analisis_suelo" (
    "id" SERIAL PRIMARY KEY,
    "id_lote" INTEGER NOT NULL REFERENCES "lote"("id") ON DELETE CASCADE,
    "laboratorio" VARCHAR(200),
    "nro_analisis" VARCHAR(100),
    "fecha_recepcion" DATE,
    "fecha_emision" DATE,
    "profundidad" VARCHAR(50),
    "muestra" VARCHAR(200),
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "analisis_suelo_detalle" (
    "id" SERIAL PRIMARY KEY,
    "id_analisis" INTEGER NOT NULL REFERENCES "analisis_suelo"("id") ON DELETE CASCADE,
    "parametro" VARCHAR(60) NOT NULL,
    "etiqueta" VARCHAR(200) NOT NULL,
    "valor_num" DECIMAL(14,4),
    "valor_texto" VARCHAR(100),
    "unidad" VARCHAR(30),
    "metodo" VARCHAR(300),
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ix_analisis_suelo_id_lote"
  ON "analisis_suelo" ("id_lote");
CREATE INDEX IF NOT EXISTS "ix_analisis_suelo_detalle_id_analisis"
  ON "analisis_suelo_detalle" ("id_analisis");
