import * as XLSX from 'xlsx';
import { calcularResultados } from './campanias.calculos';

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v: number): number => Math.round(v * 100) / 100;

const fechaExcel = (f: string): Date | string => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(f));
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return f || '';
};

const sanitizeSheetName = (name: string): string => {
  const clean = name
    .trim()
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 31);
  return clean || 'CAMPANIA';
};

/**
 * Genera un archivo .xls (BIFF8) con el layout de la primera hoja del modelo
 * de referencia "LOTE ESTE": cabecera de campaña, detalle de costos, labores,
 * insumos, costos varios y resultados económicos.
 *
 * La hoja puede llevar el nombre del lote o de la campaña.
 */
export function buildCampaniaXls(campania: any): Buffer {
  const supSembrada = num(campania.supSembrada);
  const supCosechada = num(campania.supCosechada);
  const supDiv = (v: number): number => (v > 0 ? v : 1);

  const resultados = calcularResultados({
    supSembrada,
    supCosechada,
    prodNetaTotalQq: num(campania.prodNetaTotalQq),
    precioXQq: num(campania.precioXQq),
    comercializacionPct: num(campania.comercializacionPct),
    cosechaXHa: num(campania.cosechaXHa),
    alquilerQqHa: num(campania.alquilerQqHa),
    labores: campania.labores || [],
    insumos: campania.insumos || [],
    costos: campania.costos || [],
  });

  const loteNombre = campania.lote?.descripcion || campania.nombre || '';
  const variedadNombre = campania.variedad?.nombre || '';
  const cultivoNombre = campania.cultivo?.nombre || '';

  const rows: (string | number | Date)[][] = [
    ['Lote', loteNombre, '', 'Variedad/Hibrido', variedadNombre],
    [],
    ['Cultivo', cultivoNombre, '', 'Sup. Sembrada', supSembrada],
    [],
    ['Produc. Neta Total (QQ)', num(campania.prodNetaTotalQq), '', 'Sup. Cosechada', supCosechada],
    [],
    ['Rendimiento (qq/ha)', round2(resultados.rendimientoQqHa), '', 'Precio ($/qq)', num(campania.precioXQq)],
    [],
    ['DETALLE DE COSTOS', '', '', 'Alquiler (QQ/ha)', num(campania.alquilerQqHa)],
    [],
    ['Comercializaci\u00f3n (%)', num(campania.comercializacionPct), '', 'Cosecha ($/ha)', num(campania.cosechaXHa)],
    [],
    ['LABORES', 'fecha', 'superficie laboreada', 'costo de labor/ha', 'costo ponderado/ha'],
    ['tipo', '', '', '', ''],
  ];

  for (const l of campania.labores || []) {
    const ponderado =
      (num(l.costoLaborHa) * num(l.superficieLaboreada)) / supDiv(supSembrada);
    rows.push([
      l.labor?.nombre || `Labor #${l.idLabor}`,
      fechaExcel(l.fecha),
      num(l.superficieLaboreada),
      num(l.costoLaborHa),
      round2(ponderado),
    ]);
  }
  rows.push(['Costo total de labores', '', '', '', round2(resultados.costoTotalLaboresHa)]);
  rows.push([]);

  rows.push(['INSUMOS', 'unidades/ha', 'costo/unidad ', 'costo total', '']);
  rows.push(['tipo', '', '', '', '']);
  for (const i of campania.insumos || []) {
    rows.push([
      i.insumo?.nombre || `Insumo #${i.id}`,
      num(i.unidadesHa),
      num(i.costoUnidad),
      round2(num(i.unidadesHa) * num(i.costoUnidad)),
      '',
    ]);
  }
  rows.push(['Costo total de insumos', '', '', round2(resultados.costoTotalInsumosHa), '']);
  rows.push([]);

  rows.push(['COSTOS VARIOS', 'unidades/ha', 'costo/unidad ', 'costo total', '']);
  rows.push(['tipo', '', '', '', '']);
  for (const k of campania.costos || []) {
    rows.push([
      k.costo?.nombre || `Costo #${k.id}`,
      num(k.unidadesHa),
      num(k.costoUnidad),
      round2(num(k.unidadesHa) * num(k.costoUnidad)),
      '',
    ]);
  }
  rows.push(['Costo total de costos', '', '', round2(resultados.costoTotalCostosHa), '']);
  rows.push([]);

  rows.push(['RESULTADOS ECONOMICOS', '', '$/ha', '$/lote', '']);
  rows.push(['Ingreso neto', '', round2(resultados.ingresoNetoHa), round2(resultados.ingresoNetoLote), '']);
  rows.push([]);
  rows.push(['Costo cosecha', '', round2(resultados.costoCosechaHa), round2(resultados.costoCosechaLote), '']);
  rows.push(['Costo labores', '', round2(resultados.costoTotalLaboresHa), round2(resultados.costoTotalLaboresLote), '']);
  rows.push(['Costo insumos', '', round2(resultados.costoTotalInsumosHa), round2(resultados.costoTotalInsumosLote), '']);
  rows.push(['Costos varios', '', round2(resultados.costoTotalCostosHa), round2(resultados.costoTotalCostosLote), '']);
  rows.push(['Total de costos directos', '', round2(resultados.totalCostosDirectosHa), round2(resultados.totalCostosDirectosLote), '']);
  rows.push([]);
  rows.push(['Margen bruto S/ alquiler', '', round2(resultados.margenBrutoSAlquilerHa), round2(resultados.margenBrutoSAlquilerLote), '']);
  rows.push(['Costo de alquiler', '', round2(resultados.costoAlquilerHa), round2(resultados.costoAlquilerLote), '']);
  rows.push(['Margen bruto C/ alquiler', '', round2(resultados.margenBrutoCAlquilerHa), round2(resultados.margenBrutoCAlquilerLote), '']);

  const ws = XLSX.utils.aoa_to_sheet(rows, { dateNF: 'yyyy-mm-dd' });
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
  ];

  const sheetName = sanitizeSheetName(loteNombre || campania.nombre || 'CAMPANIA');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return XLSX.write(wb, { bookType: 'biff8', type: 'buffer', cellDates: true });
}