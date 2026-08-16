// Helpers de cálculo para la vista Campaña.
// Réplica del archivo `gabino-agrogestion-ui/src/lib/campanias.ts` para que
// el backend pueda devolver totales ya computados en el dashboard.

export interface CampaniaLaborCalc {
  idLabor: number;
  superficieLaboreada: number | string | null;
  costoLaborHa: number | string | null;
}

export interface CampaniaInsumoCalc {
  idInsumo: number;
  unidadesHa: number | string | null;
  costoUnidad: number | string | null;
  superficieAplicada?: number | string | null;
}

export interface CampaniaCostoCalc {
  idCosto: number;
  unidadesHa: number | string | null;
  costoUnidad: number | string | null;
}

export interface CampaniaParaCalculo {
  supSembrada: number;
  supCosechada: number;
  prodNetaTotalQq: number;
  precioXQq: number;
  comercializacionPct: number;
  cosechaXHa: number;
  alquilerQqHa: number;
  labores: CampaniaLaborCalc[];
  insumos: CampaniaInsumoCalc[];
  costos: CampaniaCostoCalc[];
}

export interface ResultadosCampania {
  rendimientoQqHa: number;
  ingresoNetoHa: number;
  ingresoNetoLote: number;

  costoCosechaHa: number;
  costoCosechaLote: number;

  costoTotalLaboresHa: number;
  costoTotalLaboresLote: number;

  costoTotalInsumosHa: number;
  costoTotalInsumosLote: number;

  costoTotalCostosHa: number;
  costoTotalCostosLote: number;

  totalCostosDirectosHa: number;
  totalCostosDirectosLote: number;

  costoAlquilerHa: number;
  costoAlquilerLote: number;

  margenBrutoSAlquilerHa: number;
  margenBrutoSAlquilerLote: number;

  margenBrutoCAlquilerHa: number;
  margenBrutoCAlquilerLote: number;
}

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

export function calcularResultados(c: CampaniaParaCalculo): ResultadosCampania {
  const supSembrada = num(c.supSembrada);
  const supCosechada = num(c.supCosechada);
  const prodNeta = num(c.prodNetaTotalQq);
  const precio = num(c.precioXQq);
  const comercPct = num(c.comercializacionPct);
  const cosechaHa = num(c.cosechaXHa);
  const alquilerQqHa = num(c.alquilerQqHa);

  const rendimientoQqHa = supCosechada > 0 ? prodNeta / supCosechada : 0;
  const ingresoNetoHa = rendimientoQqHa * precio * (1 - comercPct / 100);

  const costoTotalLaboresHa = (c.labores || []).reduce((acc, l) => {
    if (supSembrada <= 0) return acc;
    return (
      acc + (num(l.costoLaborHa) * num(l.superficieLaboreada)) / supSembrada
    );
  }, 0);

  const costoTotalInsumosHa = (c.insumos || []).reduce((acc, i) => {
    if (supSembrada <= 0) return acc;
    return (
      acc +
      (num(i.unidadesHa) * num(i.costoUnidad) * num(i.superficieAplicada)) /
        supSembrada
    );
  }, 0);
  const costoTotalCostosHa = (c.costos || []).reduce(
    (acc, k) => acc + num(k.unidadesHa) * num(k.costoUnidad),
    0,
  );

  const totalCostosDirectosHa =
    cosechaHa + costoTotalLaboresHa + costoTotalInsumosHa + costoTotalCostosHa;
  const margenBrutoSAlquilerHa = ingresoNetoHa - totalCostosDirectosHa;
  const costoAlquilerHa = alquilerQqHa * precio;
  const margenBrutoCAlquilerHa = margenBrutoSAlquilerHa - costoAlquilerHa;

  return {
    rendimientoQqHa,
    ingresoNetoHa,
    ingresoNetoLote: ingresoNetoHa * supCosechada,

    costoCosechaHa: cosechaHa,
    costoCosechaLote: cosechaHa * supCosechada,

    costoTotalLaboresHa,
    costoTotalLaboresLote: costoTotalLaboresHa * supSembrada,

    costoTotalInsumosHa,
    costoTotalInsumosLote: costoTotalInsumosHa * supSembrada,

    costoTotalCostosHa,
    costoTotalCostosLote: costoTotalCostosHa * supSembrada,

    totalCostosDirectosHa,
    totalCostosDirectosLote:
      cosechaHa * supCosechada +
      costoTotalLaboresHa * supSembrada +
      costoTotalInsumosHa * supSembrada +
      costoTotalCostosHa * supSembrada,

    costoAlquilerHa,
    costoAlquilerLote: costoAlquilerHa * supCosechada,

    margenBrutoSAlquilerHa,
    margenBrutoSAlquilerLote: margenBrutoSAlquilerHa * supCosechada,

    margenBrutoCAlquilerHa,
    margenBrutoCAlquilerLote: margenBrutoCAlquilerHa * supCosechada,
  };
}
