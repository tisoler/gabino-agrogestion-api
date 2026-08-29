import { Injectable } from "@nestjs/common";

/**
 * Contrato del cache de respuestas de NASA POWER. La PoC usa una
 * implementación en memoria; el día que se necesite compartir el cache entre
 * instancias o persistirlo, se agrega una implementación Redis con la misma
 * interfaz (swap de provider en el módulo, sin tocar NasaPowerService).
 */
export interface PowerCacheProvider {
  get(key: string): string | null;
  set(key: string, value: string, ttlMs: number): void;
}

export const POWER_CACHE = Symbol("POWER_CACHE");

@Injectable()
export class InMemoryPowerCache implements PowerCacheProvider {
  private readonly store = new Map<string, { data: string; exp: number }>();

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, value: string, ttlMs: number): void {
    this.store.set(key, { data: value, exp: Date.now() + ttlMs });
  }
}
