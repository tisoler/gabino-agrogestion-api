import * as XLSX from "xlsx";
import type { Campania } from "../entities/campania.entity";

export interface SegurosFilaInsumo {
  campania: Campania;
  qq: number | null;
}

export const SEGUROS_HEADER = [
  "PRODUCTOR",
  "CAMPO",
  "LOTE",
  "SUPERFICIE",
  "CULTIVO",
  "LATITUD",
  "LONGITUD",
  "FECHA DE SIEMBRA",
  "VARIEDAD",
  "QQ A ASEGURAR",
];

/**
 * Decimal → `33º 31' 47,65''` (como la planilla de referencia de la aseguradora).
 * Se usa el valor absoluto (todas las coordenadas son S/O).
 */
export function decimalADms(decimal: number): string {
  const abs = Math.abs(decimal);
  const grados = Math.floor(abs);
  const minutosFloat = (abs - grados) * 60;
  const minutos = Math.floor(minutosFloat);
  const segundos = (minutosFloat - minutos) * 60;
  const segStr = segundos.toFixed(2).replace(".", ",").padStart(5, "0");
  return `${grados}º ${String(minutos).padStart(2, "0")}' ${segStr}''`;
}

/** Número con decimales con coma, sin ceros de más (18,5 / 30). */
export function fmtEs(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "";
  const v = Number(n);
  return String(Number(v.toFixed(2))).replace(".", ",");
}

/** YYYY-MM-DD → DD/MM/YYYY. */
export function fmtFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? Number(n) : null;
};

/**
 * Arma las filas de la planilla (header + una fila por producción) con el
 * formato de la aseguradora. `qq` es lo ingresado en el modal (no lo guardado).
 */
export function buildSegurosRows(items: SegurosFilaInsumo[]): string[][] {
  const rows: string[][] = [SEGUROS_HEADER];
  for (const { campania: c, qq } of items) {
    const centroide = (
      c.lote as unknown as {
        centroide?: { lat: number; lng: number } | null;
      } | null
    )?.centroide;
    const lat = centroide?.lat != null ? num(centroide.lat) : null;
    const lng = centroide?.lng != null ? num(centroide.lng) : null;
    rows.push([
      c.lote?.empresa?.nombre ?? `Productor #${c.lote?.idEmpresa ?? "—"}`,
      c.lote?.campo?.nombre ?? "",
      c.lote?.descripcion ?? `Lote #${c.idLote}`,
      fmtEs(c.supSembrada != null ? num(c.supSembrada) : null),
      c.cultivo?.nombre ?? "",
      lat != null ? decimalADms(lat) : "",
      lng != null ? decimalADms(lng) : "",
      fmtFechaCorta(c.fechaSiembra),
      c.variedad?.nombre ?? "",
      qq != null ? fmtEs(qq) : "",
    ]);
  }
  return rows;
}

/** Planilla en .xls (BIFF8, misma técnica que el export de campaña). */
export function buildSegurosXls(rows: string[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SEGUROS");
  return XLSX.write(wb, { bookType: "biff8", type: "buffer" });
}

/** Planilla en .csv (separador `;`, BOM para que Excel la abra en es-AR). */
export function buildSegurosCsv(rows: string[][]): Buffer {
  const esc = (v: string): string => `"${v.replace(/"/g, '""')}"`;
  const text = `﻿${rows.map((r) => r.map(esc).join(";")).join("\r\n")}`;
  return Buffer.from(text, "utf8");
}

export function nombreArchivoSeguros(
  aseguradora: string,
  formato: "csv" | "xls",
): string {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const limpio = aseguradora
    .trim()
    .replace(/[\\/*?:[\]]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 30);
  return `seguros-${limpio || "planilla"}-${fecha}.${formato}`;
}
