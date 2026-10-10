/**
 * Catálogo de determinaciones del informe SUELOFERTIL (POC: un solo
 * laboratorio; otros se agregan como catálogos nuevos).
 *
 * `claves` se matchea contra el inicio de la línea normalizada (la columna
 * Determinación va primera). Deben ser distintivas: evitar abreviaturas
 * cortas que aparecen en Metodología ("amonio" está en "acetato de amonio")
 * o en el pie ("boro" está en "laboratorio").
 */
export interface ParametroSuelo {
  codigo: string;
  etiqueta: string;
  claves: string[];
  /** Unidad por defecto si el OCR no la trae (null = sin default). */
  unidad: string | null;
  /** "numero" | "texto" | "ph" | "numero_o_texto" */
  tipo: "numero" | "texto" | "ph" | "numero_o_texto";
  metodo?: string;
}

export const PARAMETROS_SUELO: ParametroSuelo[] = [
  {
    codigo: "materia_organica",
    etiqueta: "Materia Orgánica (M.O.)",
    claves: ["materia organica"],
    unidad: "g/kg",
    tipo: "numero",
  },
  {
    codigo: "nitrogeno_total",
    etiqueta: "Nitrógeno Total (Nt)",
    claves: ["nitrogeno total"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "relacion_cn",
    etiqueta: "Relación C/N",
    claves: ["relacion c n"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "cic",
    etiqueta: "Capacidad de Intercambio Catiónico (C.I.C.)",
    claves: ["capacidad de intercambio"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "n_no3",
    etiqueta: "Nitrógeno de Nitratos (N-NO3)",
    claves: ["nitrogeno de nitratos", "nitratos (n no3"],
    unidad: "mg/kg",
    tipo: "numero",
  },
  {
    codigo: "amonio",
    etiqueta: "Amonio (NH4)",
    claves: ["amonio (nh"],
    unidad: "mg/kg",
    tipo: "numero",
  },
  {
    codigo: "p_bray",
    etiqueta: "Fósforo extraíble (P) – Bray I",
    claves: ["bray"],
    unidad: "mg/kg",
    tipo: "numero",
    metodo: "Bray I",
  },
  {
    codigo: "p_olsen",
    etiqueta: "Fósforo extraíble (P) – Olsen",
    claves: ["olsen"],
    unidad: "mg/kg",
    tipo: "numero",
    metodo: "Olsen",
  },
  {
    codigo: "s_so4",
    etiqueta: "Azufre de Sulfatos (S-SO4)",
    claves: ["azufre de sulfatos"],
    unidad: "mg/kg",
    tipo: "numero",
  },
  {
    codigo: "ph",
    etiqueta: "Reacción del Suelo (pH)",
    claves: ["reaccion del suelo"],
    unidad: null,
    tipo: "ph",
  },
  {
    codigo: "ph_pot",
    etiqueta: "Acidez Potencial (pH Pot)",
    claves: ["acidez potencial"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "ce",
    etiqueta: "Conductividad Eléctrica (C.E.)",
    claves: ["conductividad electrica c e"],
    unidad: null,
    tipo: "numero_o_texto",
  },
  {
    codigo: "ces",
    etiqueta: "Conductividad eléctrica (CES)",
    claves: ["conductividad electrica (ces)"],
    unidad: null,
    tipo: "numero_o_texto",
  },
  {
    codigo: "calcio",
    etiqueta: "Calcio (Ca)",
    claves: ["calcio"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "magnesio",
    etiqueta: "Magnesio (Mg)",
    claves: ["magnesio"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "potasio",
    etiqueta: "Potasio (K)",
    claves: ["potasio"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "sodio",
    etiqueta: "Sodio (Na)",
    claves: ["sodio"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "psi",
    etiqueta: "Porcentaje de Sodio Intercambiable (P.S.I)",
    claves: ["porcentaje de sodio"],
    unidad: "%",
    tipo: "numero",
  },
  {
    codigo: "ras",
    etiqueta: "Índice R.A.S.",
    claves: ["indice r"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "zinc",
    etiqueta: "Zinc (Zn)",
    claves: ["zinc"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "manganeso",
    etiqueta: "Manganeso (Mn)",
    claves: ["manganeso"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "cobre",
    etiqueta: "Cobre (Cu)",
    claves: ["cobre"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "hierro",
    etiqueta: "Hierro (Fe)",
    claves: ["hierro"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "boro",
    etiqueta: "Boro (B)",
    claves: ["boro (b)"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "cloruros",
    etiqueta: "Cloruros (Cl)",
    claves: ["cloruros"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "azufre_total",
    etiqueta: "Azufre total (St)",
    claves: ["azufre total"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "fosforo_total",
    etiqueta: "Fósforo total (Pt)",
    claves: ["fosforo total"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "densidad_aparente",
    etiqueta: "Densidad aparente (dap)",
    claves: ["densidad aparente"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "capacidad_campo",
    etiqueta: "Capacidad de campo (CC)",
    claves: ["capacidad de campo"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "pmp",
    etiqueta: "Punto de marchitez permanente (PMP)",
    claves: ["punto de marchitez", "marchitez permanente"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "carbono_organico_particulado",
    etiqueta: "Carbono Orgánico Particulado (C.O.P.)",
    claves: ["carbono organico"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "nan",
    etiqueta: "Nitrógeno anaeróbico (Nan)",
    claves: ["nitrogeno anaerobico"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "humedad",
    etiqueta: "Humedad (H°)",
    claves: ["humedad"],
    unidad: null,
    tipo: "numero",
  },
  {
    codigo: "arcilla",
    etiqueta: "Arcilla",
    claves: ["arcilla"],
    unidad: "%",
    tipo: "numero",
  },
  {
    codigo: "limo",
    etiqueta: "Limo",
    claves: ["limo"],
    unidad: "%",
    tipo: "numero",
  },
  {
    codigo: "arena",
    etiqueta: "Arena",
    claves: ["arena"],
    unidad: "%",
    tipo: "numero",
  },
];
