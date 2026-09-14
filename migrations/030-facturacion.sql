-- 030-facturacion.sql — Monitor de balance para sys-admin
--
-- Convenciones:
--  * El costo a cobrar por producción es el 10% del precio de pizarra CAC
--    ($/Tn) del cereal (soja, girasol, maíz, trigo, sorgo). Si el cultivo no
--    tiene precio de pizarra se usa la tarifa base de `facturacion_config`
--    (hoy $30.000, editable por sys-admin desde la UI).
--  * `produccion_pago` vincula cada campaña con su estado de pago. Al pasar a
--    "pagado" se congela el precio de referencia y el monto (registro
--    histórico); los pendientes se calculan en vivo con la pizarra vigente.
--  * `precio_pizarra` guarda snapshots del scraping de la CAC para fallback
--    cuando el sitio no responde.

-- Tarifa base y futuros parámetros (clave → valor)
CREATE TABLE IF NOT EXISTS "facturacion_config" (
    "clave" VARCHAR(50) PRIMARY KEY,
    "valor" DECIMAL(14,2) NOT NULL,
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO "facturacion_config" ("clave", "valor")
VALUES ('tarifa_base', 30000)
ON CONFLICT ("clave") DO NOTHING;

-- Snapshots de precios de pizarra CAC (un registro por cereal y fecha)
CREATE TABLE IF NOT EXISTS "precio_pizarra" (
    "id" SERIAL PRIMARY KEY,
    "cultivo" VARCHAR(30) NOT NULL,
    "precio_ars" DECIMAL(14,2),
    "precio_usd" DECIMAL(14,2),
    "fecha_pizarra" DATE NOT NULL DEFAULT CURRENT_DATE,
    "estimado" BOOLEAN NOT NULL DEFAULT FALSE,
    "sin_cotizacion" BOOLEAN NOT NULL DEFAULT FALSE,
    "tc_bna" DECIMAL(14,2),
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "uq_precio_pizarra_cultivo_fecha" UNIQUE ("cultivo", "fecha_pizarra")
);

-- Estado de pago por producción (campaña)
CREATE TABLE IF NOT EXISTS "produccion_pago" (
    "id" SERIAL PRIMARY KEY,
    "id_campania" INTEGER NOT NULL UNIQUE REFERENCES "campania"("id") ON DELETE CASCADE,
    "estado" VARCHAR(10) NOT NULL DEFAULT 'pendiente'
        CONSTRAINT "chk_produccion_pago_estado" CHECK ("estado" IN ('pendiente', 'pagado')),
    "precio_referencia" DECIMAL(14,2),
    "uso_tarifa_base" BOOLEAN NOT NULL DEFAULT FALSE,
    "monto" DECIMAL(14,2),
    "fecha_pago" TIMESTAMPTZ,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
