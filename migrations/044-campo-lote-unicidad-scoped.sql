-- Gabino Agrogestión - Migración 044
-- Unicidad scoped: campo único dentro de productor, lote único dentro de campo.
--
-- Hasta ahora el nombre de campo era GLOBAL (índice uq_campo_nombre de la
-- migración 013 + validación global en el servicio), lo que impedía repetir
-- un nombre de campo en otro productor. Y lote no tenía validación alguna.
-- Nuevo contrato (validado en la capa de servicio):
--   * campo: (id_empresa, LOWER(nombre)) único entre activos.
--   * lote: (id_empresa, id_campo, LOWER(descripcion)) único entre activos
--     con descripción no vacía. Lotes "sin campo" (id_campo NULL) se agrupan
--     entre sí dentro del productor. Descripciones vacías/NULL no se controlan.
-- Los índices son red de seguridad ante condiciones de carrera.
--
-- APLICAR A MANO. Si hay duplicados preexistentes, el script aborta con el
-- detalle: hay que renombrar/desactivar duplicados y reintentar.

-- ---------------------------------------------------------------------------
-- 1) Guardas: abortar con detalle si ya existen duplicados scoped.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_campo TEXT;
  v_lote TEXT;
BEGIN
  SELECT string_agg(
    format('empresa=%s nombre="%s" x%s', COALESCE(id_empresa::text, 'NULL'), nombre, n),
    '; '
  )
  INTO v_campo
  FROM (
    SELECT id_empresa, MIN(nombre) AS nombre, COUNT(*) AS n
    FROM "campo"
    WHERE "activo" = true
    GROUP BY id_empresa, LOWER(TRIM("nombre"))
    HAVING COUNT(*) > 1
  ) d;
  IF v_campo IS NOT NULL THEN
    RAISE EXCEPTION 'Migración 044 bloqueada: campos duplicados en el mismo productor: %', v_campo;
  END IF;

  SELECT string_agg(
    format('empresa=%s campo=%s descripcion="%s" x%s', id_empresa, campo, descripcion, n),
    '; '
  )
  INTO v_lote
  FROM (
    SELECT id_empresa, COALESCE(id_campo, -1) AS campo, MIN(descripcion) AS descripcion, COUNT(*) AS n
    FROM "lote"
    WHERE "activo" = true
      AND NULLIF(TRIM(COALESCE("descripcion", '')), '') IS NOT NULL
    GROUP BY id_empresa, COALESCE(id_campo, -1), LOWER(TRIM("descripcion"))
    HAVING COUNT(*) > 1
  ) d;
  IF v_lote IS NOT NULL THEN
    RAISE EXCEPTION 'Migración 044 bloqueada: lotes duplicados en el mismo campo: %', v_lote;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Campo: reemplazar el índice global por uno scoped a productor.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "uq_campo_nombre";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_campo_empresa_nombre"
    ON "campo"(COALESCE("id_empresa", -1), LOWER("nombre"))
    WHERE "activo" = true;

-- ---------------------------------------------------------------------------
-- 3) Lote: índice scoped a (productor, campo).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "uq_lote_empresa_campo_descripcion"
    ON "lote"("id_empresa", COALESCE("id_campo", -1), LOWER("descripcion"))
    WHERE "activo" = true
      AND NULLIF(TRIM(COALESCE("descripcion", '')), '') IS NOT NULL;
