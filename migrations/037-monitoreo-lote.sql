-- 037-monitoreo-lote.sql — Monitoreo en lote (asesor en campo).
--
-- Diseño:
--  * `monitoreo_lote`: un registro por visita/observación, asociado a una
--    producción (`id_campania`). Sin constraint de unicidad: se permite más
--    de un monitoreo por producción y fecha.
--  * `fecha` + `hora` separadas (el asesor carga ambas; por defecto la actual).
--  * `diagnostico` obligatorio; `observaciones` opcional.
--  * `creado_por_uid`: UID de Firebase de quien lo creó (trazabilidad).
--  * Borrado lógico vía `activo` (igual que el resto de las entidades).

CREATE TABLE IF NOT EXISTS "monitoreo_lote" (
    "id" SERIAL PRIMARY KEY,
    "id_campania" INTEGER NOT NULL REFERENCES "campania"("id") ON DELETE CASCADE,
    "fecha" DATE NOT NULL,
    "hora" TIME NOT NULL,
    "diagnostico" TEXT NOT NULL,
    "observaciones" TEXT,
    "creado_por_uid" VARCHAR(128),
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS "ix_monitoreo_lote_id_campania"
  ON "monitoreo_lote" ("id_campania");
CREATE INDEX IF NOT EXISTS "ix_monitoreo_lote_fecha"
  ON "monitoreo_lote" ("fecha");
