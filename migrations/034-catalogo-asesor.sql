-- 034-catalogo-asesor.sql — Ítems de asesor (no globales, no de una empresa).
--
-- Diseño (triple alcance):
--  * `uid_propietario` NULL + `id_empresa` NULL → global (sys-admin).
--  * `uid_propietario` = UID asesor + `id_empresa` NULL → del asesor,
--    usable en todas sus empresas (productores).
--  * `uid_propietario` NULL + `id_empresa` = E → de la empresa E (como hoy).
--  * Ambos seteados a la vez no es válido (lo impide el servicio).
--
-- Sin backfill: NULL conserva la semántica actual (empresa NULL = global,
-- empresa N = de N).

ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "uid_propietario" VARCHAR(128);
ALTER TABLE "insumo" ADD COLUMN IF NOT EXISTS "uid_propietario" VARCHAR(128);
ALTER TABLE "costo" ADD COLUMN IF NOT EXISTS "uid_propietario" VARCHAR(128);
ALTER TABLE "cultivo" ADD COLUMN IF NOT EXISTS "uid_propietario" VARCHAR(128);
ALTER TABLE "variedad" ADD COLUMN IF NOT EXISTS "uid_propietario" VARCHAR(128);
