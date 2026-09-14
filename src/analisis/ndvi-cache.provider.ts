import { PowerCacheProvider } from "./power-cache.provider";

/**
 * Cache de las respuestas de las fuentes de NDVI (Copernicus Process API y
 * NASA GIBS). Reusa el contrato de PowerCacheProvider: mismo provider en
 * memoria hoy, Redis a futuro con sólo cambiar la implementación registrada
 * en el módulo (los históricos pasados se cachean con TTL largo porque son
 * inmutables).
 */
export const NDVI_CACHE = Symbol("NDVI_CACHE");

export type NdviCacheProvider = PowerCacheProvider;
