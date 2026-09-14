/** Estadísticas NDVI de una ventana temporal sobre el polígono del lote. */
export interface NdviStats {
  fuente: "sentinel-2" | "viirs";
  ndviMedia: number | null;
  min: number | null;
  max: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  desvioStd: number | null;
  /** % del polígono con dato válido (píxeles sin nube/sombra/sombra de nube). */
  coberturaPct: number | null;
  /** Píxeles válidos dentro del polígono (calidad del dato). */
  pixeles: number | null;
  /** Nº de escenas usadas (Sentinel-2) o compositivos (VIIRS: 1). */
  escenas: number | null;
}

export interface FilaNdvi extends NdviStats {
  /** Ventana: "YYYY-MM" (mes/campaña) o "YYYY-MM-DD" (actual). */
  fecha: string;
}

export interface RespuestaNdvi {
  lote: {
    id: number;
    descripcion: string | null;
    campoNombre: string | null;
    empresaNombre: string | null;
    centroide: { lat: number; lng: number } | null;
  };
  periodo: "actual" | "mes" | "campania";
  campania: string | null;
  /** Fuente global del resultado: S2, VIIRS o mixta si conviven en la serie. */
  fuente: "sentinel-2" | "viirs" | "mixta" | null;
  ultimo: FilaNdvi | null;
  serie: FilaNdvi[];
  agregados: {
    ndviMedio: number | null;
    /** p90 − p10 del último dato: heterogeneidad intra-lote. */
    heterogeneidad: number | null;
    ventanasConDatos: number;
  };
  /** true si el lote no tiene polígono y se usó un cuadrado ~1 km en el centroide. */
  aproximado?: boolean;
}
