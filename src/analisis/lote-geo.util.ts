import { ForbiddenException, Logger } from "@nestjs/common";
import { Roles } from "src/constantes";
import { Lote } from "../entities/lote.entity";

export type Anillo = Array<[number, number]>; // [lng, lat]

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Acceso por empresa al lote (mismo criterio que el endpoint de clima):
 * admins sin restricción; el resto sólo sobre lotes de sus empresas.
 */
export function validarAccesoLote(lote: Lote, user: any): void {
  const isAdmin = user?.roles?.includes(Roles.SYS_ADMIN);
  const userEmpresas: number[] = (user?.idEmpresas || []).map((e: any) =>
    Number(e),
  );
  if (!isAdmin && !userEmpresas.includes(lote.idEmpresa)) {
    Logger.warn(
      `[analisis] 403: lote ${lote.id} (empresa ${lote.idEmpresa}) no accesible ` +
        `para uid=${user?.id} roles=${JSON.stringify(user?.roles ?? [])} ` +
        `idEmpresas=${JSON.stringify(userEmpresas)}`,
      "lote-geo",
    );
    throw new ForbiddenException(
      `No tiene permisos para el lote ${lote.id} (empresa ${lote.idEmpresa})`,
    );
  }
}

export function centroideDe(lote: Lote): { lat: number; lng: number } | null {
  if (lote.centroide) return lote.centroide;
  const coords = anilloExterior(lote.geometria);
  if (coords.length === 0) return null;
  const lat = coords.reduce((a, c) => a + c[1], 0) / coords.length;
  const lng = coords.reduce((a, c) => a + c[0], 0) / coords.length;
  return { lat, lng };
}

/** Anillo exterior del polígono del lote (Point → anillo de un vértice). */
export function anilloExterior(geometria: object | null | undefined): Anillo {
  const g = geometria as { type?: string; coordinates?: unknown };
  if (g?.type === "Point" && Array.isArray(g.coordinates)) {
    return [g.coordinates as [number, number]];
  }
  const rings =
    g?.type === "Polygon"
      ? (g.coordinates as unknown[][])
      : g?.type === "MultiPolygon"
        ? (g.coordinates as unknown[][][])[0]
        : null;
  if (!rings || rings.length === 0) return [];
  return (rings[0] as Array<[number, number]>).map((c) => [
    Number(c[0]),
    Number(c[1]),
  ]);
}

export function bboxDe(anillo: Anillo): Bbox | null {
  if (anillo.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of anillo) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

/** Test punto-en-polígono (ray casting) sobre el anillo exterior. */
export function puntoEnAnillo(
  lng: number,
  lat: number,
  anillo: Anillo,
): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    const cruza =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}
