import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
// pdfmake exporta un singleton (instancia); `import = require` preserva el
// `this` de sus métodos (createPdf/setFonts/etc.).
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfMake = require("pdfmake");
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import { Prescripcion } from "../entities/prescripcion.entity";

// ---------------------------------------------------------------------------
// Constantes del layout de impresión (media hoja A4 vertical), replicadas en
// puntos. Ver src/index.css (`.print-prescripcion`) de la UI.
//   1mm = 2.83465pt · 1px = 0.75pt
// ---------------------------------------------------------------------------
const MM = 2.83465;
const mm = (v: number) => v * MM;

const PAGE_W = 148.4;
const PAGE_H = 205.2;

const MEMBRETE_MARGIN = 5; // padding lateral del membrete
const BODY_SIDE = 7; // padding lateral del cuerpo
const BODY_TOP = 4; // padding superior del cuerpo
const BODY_BOTTOM = 4; // padding inferior del cuerpo (no crítico, el pie va fijo)
const PIE_MARGIN = 5; // margen lateral del pie
const PIE_PAD = 1; // padding interno del pie
const BORDER_PT = 0.75; // 1px

const TITULO_GAP_BOTTOM = 3; // margin-bottom del título
const DATOS_GAP_BOTTOM = 4; // margin-bottom de los datos
const DATOS_GAP_ROW = 1.5; // gap vertical entre filas de datos
const DATOS_GAP_COL = 6; // gap horizontal entre columnas de datos

// ---------------------------------------------------------------------------
// Formato numérico/fecha es-AR determinista (sin depender de ICU).
// ---------------------------------------------------------------------------
function fmtNum(v: number | null | undefined, maxDec = 2): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(maxDec);
  let [int, frac] = fixed.split(".");
  frac = (frac || "").replace(/0+$/, "");
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  let out = frac ? `${int},${frac}` : int;
  if (neg) out = `-${out}`;
  return out;
}

function fmtHa(v: number | null | undefined, maxDec = 2): string {
  return `${fmtNum(v, maxDec)} ha`;
}

function convertirUnidad(
  valor: number | null | undefined,
  unidad: string | null | undefined,
): { valor: number | null; unidad: string | null } {
  const u = (unidad || "").toLowerCase();
  if (u !== "kg" && u !== "lt") {
    return {
      valor: valor ?? null,
      unidad: u ? (u === "unidad" ? "u" : (unidad ?? null)) : null,
    };
  }
  if (valor != null && Number.isFinite(valor) && valor < 1) {
    return { valor: valor * 1000, unidad: u === "kg" ? "gr" : "cc" };
  }
  return { valor: valor ?? null, unidad: u };
}

function fmtDosisCantidad(
  valor: number | null | undefined,
  unidad: string | null | undefined,
  maxDec = 2,
  perHa = false,
): string {
  const c = convertirUnidad(valor, unidad);
  const numero = fmtNum(c.valor, maxDec);
  if (!c.unidad) return numero;
  return `${numero} ${c.unidad}${perHa ? "/ha" : ""}`;
}

function fmtFecha(fecha: string | undefined | null): string {
  if (!fecha) return "—";
  const s = String(fecha).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
@Injectable()
export class PrescripcionesPdfService {
  private readonly images: Record<string, string>;
  private readonly membreteWpt: number;
  private readonly membreteHpt: number;
  private readonly pieWpt: number;
  private readonly pieHpt: number;
  private readonly pieBlockHpt: number;

  constructor() {
    const assetsDir = path.resolve(
      __dirname,
      "..",
      "..",
      "prescripciones",
      "assets",
    );
    const fontsDir = path.join(assetsDir, "fonts");

    const read = (p: string) => fs.readFileSync(p);
    const dataUrl = (buf: Buffer) =>
      `data:image/png;base64,${buf.toString("base64")}`;

    // Políticas de acceso de pdfmake: no descargamos URLs remotas y sólo
    // permitimos leer archivos locales dentro de la carpeta de assets.
    pdfMake.setUrlAccessPolicy(() => false);
    pdfMake.setLocalAccessPolicy((p: string) => p.startsWith(assetsDir));

    // Fuentes: Inter Regular/Bold como familia "Inter" y SemiBold como
    // familia aparte (pdfmake sólo soporta normal/bold/italics por familia).
    // Se pasan como rutas de archivo (pdfmake las lee del disco).
    pdfMake.setFonts({
      Inter: {
        normal: path.join(fontsDir, "Inter-Regular.ttf"),
        bold: path.join(fontsDir, "Inter-Bold.ttf"),
      },
      InterSemibold: {
        normal: path.join(fontsDir, "Inter-SemiBold.ttf"),
        bold: path.join(fontsDir, "Inter-Bold.ttf"),
      },
    });

    this.images = {
      membrete: dataUrl(read(path.join(assetsDir, "membrete.png"))),
      pie: dataUrl(read(path.join(assetsDir, "pie.png"))),
    };

    // Dimensiones de las imágenes para calcular alturas manteniendo el ratio.
    const membreteSize = pngSize(read(path.join(assetsDir, "membrete.png")));
    const pieSize = pngSize(read(path.join(assetsDir, "pie.png")));

    this.membreteWpt = mm(PAGE_W - 2 * MEMBRETE_MARGIN);
    this.membreteHpt =
      (this.membreteWpt * membreteSize.height) / membreteSize.width;

    // Pie: el ancho útil interno = caja (con border-box) menos padding y borde.
    const pieBoxWpt = mm(PAGE_W - 2 * PIE_MARGIN);
    this.pieWpt = pieBoxWpt - 2 * mm(PIE_PAD) - 2 * BORDER_PT;
    this.pieHpt = (this.pieWpt * pieSize.height) / pieSize.width;
    this.pieBlockHpt = this.pieHpt + 2 * mm(PIE_PAD) + 2 * BORDER_PT;
  }

  async buildPdf(p: Prescripcion): Promise<Buffer> {
    const doc = pdfMake.createPdf(this.construirDocumento(p));
    return doc.getBuffer();
  }

  private construirDocumento(p: Prescripcion): TDocumentDefinitions {
    const productor = p.campania?.lote?.empresa?.nombre || "—";
    const campo = p.campania?.lote?.campo?.nombre || "—";
    const labor = p.labor?.nombre || `Labor #${p.idLabor}`;
    const superficie = fmtHa(p.totalHaAplicacion);
    const fecha = fmtFecha(p.fecha);
    const obsBox = this.observacionesBox(p.observaciones);

    // Lotes: con uno solo se muestra como siempre; con varios, cada lote con
    // su superficie para que la prescripción quede legible en una sola hoja.
    const loteRows = p.lotes ?? [];
    const loteText =
      loteRows.length > 1
        ? loteRows
            .map(
              (l) =>
                `${l.campania?.lote?.descripcion || `Lote #${l.campania?.lote?.id ?? "?"}`} (${fmtNum(l.superficieAplicada)} ha)`,
            )
            .join(" · ")
        : p.campania?.lote?.descripcion ||
          `Lote #${p.campania?.lote?.id ?? "—"}`;
    // Cada lote puede tener un cultivo distinto: se lista una vez por cultivo.
    const cultivo =
      loteRows.length > 1
        ? Array.from(
            new Set(
              loteRows
                .map((l) => l.campania?.cultivo?.nombre)
                .filter((c): c is string => !!c),
            ),
          ).join(" · ") ||
          p.campania?.cultivo?.nombre ||
          "—"
        : p.campania?.cultivo?.nombre || "—";

    return {
      pageSize: { width: mm(PAGE_W), height: mm(PAGE_H) },
      pageMargins: [0, 0, 0, this.pieBlockHpt],
      defaultStyle: { font: "Inter", fontSize: 10.5 },
      images: this.images,
      content: [
        {
          image: "membrete",
          width: this.membreteWpt,
          height: this.membreteHpt,
          margin: [mm(MEMBRETE_MARGIN), 0, mm(MEMBRETE_MARGIN), 0],
        },
        {
          stack: [
            this.titulo(fecha),
            this.datosGrid(
              productor,
              campo,
              loteText,
              cultivo,
              labor,
              superficie,
            ),
            this.insumosTable(p),
            ...(obsBox ? [obsBox] : []),
          ],
          margin: [mm(BODY_SIDE), mm(BODY_TOP), mm(BODY_SIDE), mm(BODY_BOTTOM)],
        },
      ],
      footer: this.pie(),
    };
  }

  private titulo(fecha: string): Content {
    return {
      table: {
        widths: ["*", "auto"],
        body: [
          [
            {
              text: "PRESCRIPCIÓN",
              bold: true,
              fontSize: 11.25,
              characterSpacing: 0.375,
            },
            {
              text: fecha,
              fontSize: 9.75,
              alignment: "right",
            },
          ],
        ],
      },
      layout: {
        hLineWidth: (i: number) => (i === 1 ? BORDER_PT : 0),
        hLineColor: () => "#000000",
        vLineWidth: () => 0,
        paddingTop: () => 0,
        paddingBottom: (i: number) => (i === 0 ? mm(2) : 0),
        paddingLeft: () => 0,
        paddingRight: () => 0,
      },
      margin: [0, 0, 0, mm(TITULO_GAP_BOTTOM)],
    };
  }

  private campo(label: string, value: string): Content {
    return {
      stack: [
        {
          text: label.toUpperCase(),
          font: "InterSemibold",
          fontSize: 7.5,
          characterSpacing: 0.375,
        },
        {
          text: value,
          font: "InterSemibold",
          fontSize: 9.75,
          margin: [0, 4, 0, 0],
        },
      ],
    };
  }

  private datosGrid(
    productor: string,
    campo: string,
    lote: string,
    cultivo: string,
    labor: string,
    superficie: string,
  ): Content {
    return {
      table: {
        widths: ["*", "*", "*"],
        body: [
          [
            this.campo("Productor", productor),
            this.campo("Campo", campo),
            this.campo("Lote", lote),
          ],
          [
            this.campo("Cultivo", cultivo),
            this.campo("Labor", labor),
            this.campo("Superficie", superficie),
          ],
        ],
      },
      layout: {
        defaultBorder: false,
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingTop: (i: number) => (i === 0 ? 0 : mm(DATOS_GAP_ROW)),
        paddingBottom: () => 0,
        paddingLeft: (i: number) => (i === 0 ? 0 : mm(DATOS_GAP_COL / 2)),
        paddingRight: (i: number) => (i === 2 ? 0 : mm(DATOS_GAP_COL / 2)),
      },
      margin: [0, 0, 0, mm(DATOS_GAP_BOTTOM)],
    };
  }

  private insumosTable(p: Prescripcion): Content {
    const header: TableCell[] = [
      {
        text: "INSUMO",
        font: "InterSemibold",
        fontSize: 8.25,
        characterSpacing: 0.375,
      },
      {
        text: "DOSIS",
        font: "InterSemibold",
        fontSize: 8.25,
        characterSpacing: 0.375,
        alignment: "right",
      },
      {
        text: "CANTIDAD TOTAL",
        font: "InterSemibold",
        fontSize: 8.25,
        characterSpacing: 0.375,
        alignment: "right",
      },
    ];

    const rows: TableCell[][] =
      p.insumos?.length === 0
        ? [
            [
              {
                text: "Esta prescripción no tiene insumos.",
                fontSize: 10.5,
                colSpan: 3,
              },
              {},
              {},
            ],
          ]
        : (p.insumos ?? []).map((i) => [
            {
              text: i.insumo?.nombre || `Insumo #${i.idInsumo}`,
              fontSize: 10.5,
            },
            {
              text: fmtDosisCantidad(
                i.cantidadPorHa,
                i.insumo?.unidad,
                2,
                true,
              ),
              fontSize: 10.5,
              alignment: "right",
            },
            {
              text: fmtDosisCantidad(i.cantidadTotal, i.insumo?.unidad, 2),
              fontSize: 10.5,
              alignment: "right",
            },
          ]);

    return {
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto"],
        body: [header, ...rows],
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 ? 0 : BORDER_PT),
        hLineColor: (i: number) => (i === 1 ? "#000000" : "#dddddd"),
        vLineWidth: () => 0,
        paddingTop: () => mm(1.5),
        paddingBottom: () => mm(1.5),
        paddingLeft: () => mm(2),
        paddingRight: () => mm(2),
      },
    };
  }

  /**
   * Recuadro de observaciones (indicaciones sobre la labor): va debajo de la
   * lista de insumos y encima del pie. Devuelve null si no hay texto.
   */
  private observacionesBox(
    observaciones: string | null | undefined,
  ): Content | null {
    const texto = observaciones?.trim();
    if (!texto) return null;
    return {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                {
                  text: "OBSERVACIONES",
                  font: "InterSemibold",
                  fontSize: 7.5,
                  characterSpacing: 0.375,
                },
                { text: texto, fontSize: 10.5, margin: [0, 3, 0, 0] },
              ] as Content[],
            },
          ],
        ],
      },
      layout: {
        fillColor: () => "#f4f4f5",
        hLineWidth: () => BORDER_PT,
        vLineWidth: () => BORDER_PT,
        hLineColor: () => "#000000",
        vLineColor: () => "#000000",
        paddingTop: () => mm(2.5),
        paddingBottom: () => mm(2.5),
        paddingLeft: () => mm(3),
        paddingRight: () => mm(3),
      },
      margin: [0, mm(5), 0, 0],
      unbreakable: true,
    };
  }

  private pie(): Content {
    return {
      table: {
        widths: ["*"],
        body: [[{ image: "pie", width: this.pieWpt, height: this.pieHpt }]],
      },
      layout: {
        hLineWidth: () => BORDER_PT,
        vLineWidth: () => BORDER_PT,
        hLineColor: () => "#000000",
        vLineColor: () => "#000000",
        paddingTop: () => mm(PIE_PAD),
        paddingBottom: () => mm(PIE_PAD),
        paddingLeft: () => mm(PIE_PAD),
        paddingRight: () => mm(PIE_PAD),
      },
      margin: [mm(PIE_MARGIN), 0, mm(PIE_MARGIN), 0],
    };
  }
}

// ---------------------------------------------------------------------------
// Lectura de dimensiones PNG (IHDR) sin dependencias extra.
// ---------------------------------------------------------------------------
function pngSize(buf: Buffer): { width: number; height: number } {
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}
