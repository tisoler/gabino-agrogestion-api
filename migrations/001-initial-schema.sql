-- Gabino Agrogestión Initial Migration

-- Empresa
CREATE TABLE IF NOT EXISTS "empresa" (
    "id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Labor
CREATE TABLE IF NOT EXISTS "labor" (
    "id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "id_empresa" INTEGER REFERENCES "empresa"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Insumo
CREATE TABLE IF NOT EXISTS "insumo" (
    "id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "id_empresa" INTEGER REFERENCES "empresa"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Costo
CREATE TABLE IF NOT EXISTS "costo" (
    "id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "id_empresa" INTEGER REFERENCES "empresa"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Campania
CREATE TABLE IF NOT EXISTS "campania" (
    "id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR NOT NULL,
    "anio_desde" INTEGER NOT NULL,
    "anio_hasta" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Lote
CREATE TABLE IF NOT EXISTS "lote" (
    "id" SERIAL PRIMARY KEY,
    "id_empresa" INTEGER NOT NULL REFERENCES "empresa"("id") ON DELETE CASCADE,
    "id_usuario" INTEGER NOT NULL,
    "descripcion" TEXT,
    "lat" DECIMAL(10,8),
    "long" DECIMAL(11,8),
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Cultivo
CREATE TABLE IF NOT EXISTS "cultivo" (
    "id" SERIAL PRIMARY KEY,
    "id_empresa" INTEGER NOT NULL REFERENCES "empresa"("id") ON DELETE CASCADE,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Variedad
CREATE TABLE IF NOT EXISTS "variedad" (
    "id" SERIAL PRIMARY KEY,
    "id_empresa" INTEGER NOT NULL REFERENCES "empresa"("id") ON DELETE CASCADE,
    "id_cultivo" INTEGER NOT NULL REFERENCES "cultivo"("id") ON DELETE CASCADE,
    "nombre" VARCHAR NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE
);
