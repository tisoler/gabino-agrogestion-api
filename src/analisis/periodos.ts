import { BadRequestException } from "@nestjs/common";

export type PeriodoClima = "actual" | "mes" | "campania";

export interface VentanaAnalisis {
  start: Date;
  end: Date;
  campania: string | null;
  mesParaSerieAnual: { anio: number; mes: number } | null;
}

/**
 * Ventanas de tiempo compartidas por los endpoints de clima (NASA POWER) y
 * NDVI (Sentinel-2/GIBS). Extraídas de AnalisisService sin cambios de
 * comportamiento: "actual" = últimos 7 días, "mes" = mes calendario,
 * "campania" = 1º de julio del año inicial hasta hoy (calendario jul–jul).
 */
export function resolverVentana(
  periodo: PeriodoClima,
  fecha?: string,
): VentanaAnalisis {
  const hoy = new Date();

  if (periodo === "actual") {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { start, end: hoy, campania: null, mesParaSerieAnual: null };
  }

  if (periodo === "mes") {
    const { anio, mes } = parseMes(fecha);
    return {
      start: new Date(anio, mes - 1, 1),
      end: new Date(anio, mes, 0),
      campania: null,
      mesParaSerieAnual: { anio, mes },
    };
  }

  const campania = normalizarCampania(fecha);
  const anioInicio = 2000 + Number(campania.split("/")[0]);
  const start = new Date(anioInicio, 6, 1); // 1º de julio
  return { start, end: hoy, campania, mesParaSerieAnual: null };
}

export function normalizarPeriodo(raw?: string): PeriodoClima {
  const p = (raw || "actual") as PeriodoClima;
  if (!["actual", "mes", "campania"].includes(p)) {
    throw new BadRequestException(
      "periodo inválido: use actual | mes | campania",
    );
  }
  return p;
}

export function parseMes(fecha?: string): { anio: number; mes: number } {
  if (fecha && /^\d{4}-\d{2}$/.test(fecha)) {
    const [a, m] = fecha.split("-").map(Number);
    if (m >= 1 && m <= 12) return { anio: a, mes: m };
  }
  const ahora = new Date();
  return { anio: ahora.getFullYear(), mes: ahora.getMonth() + 1 };
}

export function normalizarCampania(fecha?: string): string {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const inicio = hoy.getMonth() >= 6 ? y : y - 1;
  const defaultCamp = `${String(inicio % 100).padStart(2, "0")}/${String(
    (inicio + 1) % 100,
  ).padStart(2, "0")}`;

  if (fecha && /^\d{2}\/\d{2}$/.test(fecha)) {
    const [a, b] = fecha.split("/").map(Number);
    if (b === (a + 1) % 100) return fecha;
  }
  return defaultCamp;
}
