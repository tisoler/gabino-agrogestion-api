import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import { PARAMETROS_SUELO, type ParametroSuelo } from "./suelo-catalogo";

const execFileAsync = promisify(execFile);

export interface DetalleExtraido {
  codigo: string;
  etiqueta: string;
  valorNum: number | null;
  valorTexto: string | null;
  unidad: string | null;
  metodo?: string;
}

export interface ExtraccionSuelo {
  laboratorio: string | null;
  nroAnalisis: string | null;
  fechaRecepcion: string | null;
  fechaEmision: string | null;
  profundidad: string | null;
  muestra: string | null;
  productorTexto: string | null;
  loteTexto: string | null;
  detalles: DetalleExtraido[];
  /** Etiquetas del catálogo sin valor detectado (informativo). */
  noDetectados: string[];
}

const MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * Unidades plausibles por parámetro (el OCR inventa unidades a veces:
 * ej. "1%" espurio). null = sin restricción.
 */
const UNIDADES_PLAUSIBLES: Record<string, string[] | null> = {
  materia_organica: ["g/kg", "%"],
  n_no3: ["mg/kg"],
  amonio: ["mg/kg"],
  p_bray: ["mg/kg"],
  p_olsen: ["mg/kg"],
  s_so4: ["mg/kg"],
  zinc: ["mg/kg"],
  manganeso: ["mg/kg"],
  cobre: ["mg/kg"],
  hierro: ["mg/kg"],
  boro: ["mg/kg"],
  psi: ["%"],
  arcilla: ["%"],
  limo: ["%"],
  arena: ["%"],
};

/**
 * Extracción de informes de análisis de suelo (POC, laboratorio SUELOFERTIL)
 * con Tesseract (sin dependencias nativas en Node: binarios del sistema).
 *
 * El archivo NO se persiste: se procesa en un temporal y se borra. El
 * resultado es un preview que el usuario acepta o ajusta antes de guardar
 * (la calidad del scan varía y el OCR puede fallar en dígitos).
 *
 * Requiere en el servidor: `pdftoppm` (poppler-utils) y `tesseract-ocr` +
 * datos `spa`. Dir temporal configurable por `OCR_TMPDIR` (en macOS el
 * binario no lee de /tmp: usar p.ej. `./.tmp-ocr`).
 */
@Injectable()
export class SueloExtraccionService {
  private readonly logger = new Logger(SueloExtraccionService.name);

  private cfg() {
    return {
      tmpDir: process.env.OCR_TMPDIR || os.tmpdir(),
      dpi: Number(process.env.OCR_DPI) || 300,
      timeoutMs: Number(process.env.OCR_TIMEOUT_MS) || 120000,
      maxPages: Number(process.env.OCR_MAX_PAGES) || 5,
      maxBytes: (Number(process.env.OCR_MAX_MB) || 15) * 1024 * 1024,
    };
  }

  catalogo(): Pick<ParametroSuelo, "codigo" | "etiqueta" | "unidad">[] {
    return PARAMETROS_SUELO.map(({ codigo, etiqueta, unidad }) => ({
      codigo,
      etiqueta,
      unidad,
    }));
  }

  async extraer(buffer: Buffer, mimetype: string): Promise<ExtraccionSuelo> {
    if (!MIME_PERMITIDOS.includes(mimetype)) {
      throw new Error(
        `Tipo de archivo no soportado (${mimetype}). Subí PDF, JPG o PNG.`,
      );
    }
    const { tmpDir, dpi, timeoutMs, maxPages, maxBytes } = this.cfg();
    if (buffer.length > maxBytes) {
      throw new Error(
        `Archivo muy pesado (máx ${Math.round(maxBytes / 1024 / 1024)} MB).`,
      );
    }

    const workDir = await fs
      .mkdir(tmpDir, { recursive: true })
      .then(() => fs.mkdtemp(path.join(tmpDir, "suelo-")));
    try {
      // Tesseract lee por archivo (el pipe por stdin es inestable según
      // entorno): las imágenes directas se vuelcan al temporal.
      const rutas: string[] =
        mimetype === "application/pdf"
          ? await this.pdfAPaginas(buffer, workDir, dpi, maxPages, timeoutMs)
          : [await this.guardarImagen(buffer, workDir, mimetype)];
      const textos: string[] = [];
      for (const ruta of rutas) {
        textos.push(await this.ocr(ruta, timeoutMs));
      }
      return this.parsear(textos.join("\n"));
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => null);
    }
  }

  // -------------------------------------------------------------------------
  // OCR
  // -------------------------------------------------------------------------
  private async pdfAPaginas(
    pdf: Buffer,
    workDir: string,
    dpi: number,
    maxPages: number,
    timeoutMs: number,
  ): Promise<string[]> {
    const entrada = path.join(workDir, "doc.pdf");
    await fs.writeFile(entrada, pdf);
    const prefijo = path.join(workDir, "pag");
    try {
      await execFileAsync(
        "pdftoppm",
        [
          "-png",
          "-r",
          String(dpi),
          "-f",
          "1",
          "-l",
          String(maxPages),
          entrada,
          prefijo,
        ],
        { timeout: timeoutMs },
      );
    } catch {
      throw new Error(
        "No se pudo leer el PDF (¿poppler instalado en el servidor?).",
      );
    }
    const archivos = (await fs.readdir(workDir))
      .filter((f) => f.startsWith("pag-") && f.endsWith(".png"))
      .sort((a, b) => this.numPagina(a) - this.numPagina(b));
    if (archivos.length === 0) {
      throw new Error("El PDF no tiene páginas legibles.");
    }
    return archivos.map((f) => path.join(workDir, f));
  }

  private async guardarImagen(
    imagen: Buffer,
    workDir: string,
    mimetype: string,
  ): Promise<string> {
    const ext = mimetype === "image/png" ? "png" : "jpg";
    const ruta = path.join(workDir, `img-0.${ext}`);
    await fs.writeFile(ruta, imagen);
    return ruta;
  }

  private numPagina(nombre: string): number {
    const m = nombre.match(/-(\d+)\.png$/);
    return m ? Number(m[1]) : 0;
  }

  private async ocr(ruta: string, timeoutMs: number): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "tesseract",
        [ruta, "stdout", "-l", "spa", "--psm", "6"],
        { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      );
      return stdout;
    } catch (e) {
      this.logger.warn(`Tesseract falló: ${e}`);
      throw new Error(
        "No se pudo procesar la imagen (¿tesseract instalado en el servidor?).",
      );
    }
  }

  // -------------------------------------------------------------------------
  // Parseo (plantilla SUELOFERTIL)
  // -------------------------------------------------------------------------
  /** minúsculas, sin acentos, no-alfanumérico → espacio. */
  private norm(s: string): string {
    return (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private primeraLineaConEtiqueta(lineas: string[], claves: string[]): number {
    for (let i = 0; i < lineas.length; i++) {
      const inicio = this.norm(lineas[i]).slice(0, 64);
      if (claves.some((c) => inicio.includes(c))) return i;
    }
    return -1;
  }

  /**
   * Limpia ruido de metodología a nivel tokens (más seguro que con regex
   * sobre el texto: un strip goloso comía el valor). Quita: profundidades
   * (000-020 cm), designaciones "Norma ... <número>", ratios (1:2.5), "1N",
   * fórmulas (*100), años sueltos sin unidad y fórmulas químicas con dígitos
   * entre paréntesis ("(S-S04)").
   */
  private tokenizarVentana(texto: string): string[] {
    const t = texto
      .replace(/g\s*x\s*g|g\.?kg|g\s*\/\s*kg/gi, "g/kg")
      .replace(/mg\s*x\s*g|mgg|mgkg|mg\s*\/\s*kg/gi, "mg/kg");
    const crudo = t.split(/\s+/).filter(Boolean);
    const limpios: string[] = [];
    let i = 0;
    const esAnioSinUnidad = (j: number): boolean => {
      const tok = crudo[j] ?? "";
      if (!/^\d{4,}$/.test(tok)) return false;
      const sig = crudo[j + 1] ?? "";
      return !/^(g\/kg|mg\/kg|%)$/i.test(sig);
    };
    while (i < crudo.length) {
      const tok = crudo[i];
      // Profundidad "000-020 cm" (junta o separada).
      if (/^\d{3}-\d{3}(cm)?$/i.test(tok)) {
        i += 1;
        if (/^cm$/i.test(crudo[i] ?? "")) i += 1;
        continue;
      }
      // "Norma ..." hasta el primer token con dígito (inclusive, tope 8).
      // Si no hay número, no se descarta nada.
      if (/^norma$/i.test(tok)) {
        let j = i + 1;
        let n = 0;
        while (j < crudo.length && !/\d/.test(crudo[j]) && n < 8) {
          j += 1;
          n += 1;
        }
        if (j < crudo.length && /\d/.test(crudo[j])) {
          i = j + 1;
          continue;
        }
      }
      if (/^\d+:\d/.test(tok)) {
        i += 1;
        continue;
      } // ratios "1:2.5"
      if (/^\d+N$/i.test(tok)) {
        i += 1;
        continue;
      } // "1N"
      if (tok === "*") {
        i += 1;
        if (/^100$/.test(crudo[i] ?? "")) i += 1;
        continue;
      }
      if (/\(.*\d.*\)/.test(tok)) {
        i += 1;
        continue;
      } // "(S-S04)"
      if (esAnioSinUnidad(i)) {
        i += 1;
        continue;
      }
      limpios.push(tok);
      i += 1;
    }
    return limpios;
  }

  /**
   * Busca el valor en los tokens de derecha a izquierda. Acepta un número si:
   *  - trae unidad de valor (g/kg, mg/kg, %), o
   *  - es decimal y lo siguiente no es palabra (evita "0.3 bares", "7 días"), o
   *  - es entero < 1000 y lo siguiente no es palabra.
   * Así los números de metodología no se confunden con valores.
   */
  private buscarValor(
    tokens: string[],
    unidades: string[] | null,
  ): { valor: number | null; unidad: string | null; usados: string[] } {
    const nada = {
      valor: null as number | null,
      unidad: null as string | null,
      usados: [] as string[],
    };
    const esUnidad = (t: string | undefined): string | null => {
      if (!t) return null;
      const m = t.toLowerCase().match(/^(g\/kg|mg\/kg|%)$/);
      return m ? m[1] : null;
    };
    const esPalabra = (t: string | undefined): boolean =>
      !!t && /^[a-záéíóúñü]+$/i.test(t);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const m = tokens[i].match(/^(\d[\d.,]*)(g\/kg|mg\/kg|%)?$/i);
      if (!m) continue;
      let unidad = m[2]?.toLowerCase() ?? null;
      let j = i + 1;
      const usados = [tokens[i]];
      if (!unidad) {
        const u = esUnidad(tokens[j]);
        if (u) {
          unidad = u;
          usados.push(tokens[j]);
          j += 1;
        }
      }
      if (unidad && unidades && !unidades.includes(unidad)) continue;
      const valor = this.parseNumeroEs(m[1]);
      if (valor === null) continue;
      const tieneDec = /[.,]/.test(m[1]);
      if (!unidad) {
        if (!tieneDec && valor >= 1000) continue;
        if (esPalabra(tokens[j])) continue;
      }
      return { valor, unidad, usados };
    }
    return nada;
  }

  /** "28,4" → 28.4 · "1.499,00" → 1499 · "2.100" → 2100 · "28.4" → 28.4 */
  private parseNumeroEs(raw: string): number | null {
    let s = raw.trim();
    if (!s) return null;
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, "");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  private extraerFechaEs(texto: string): string | null {
    const m = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    const d = m[1].padStart(2, "0");
    const mes = m[2].padStart(2, "0");
    let anio = m[3];
    if (anio.length === 2) anio = `20${anio}`;
    if (mes < "01" || mes > "12" || d < "01" || d > "31") return null;
    return `${anio}-${mes}-${d}`;
  }

  private campo(
    texto: string,
    re: RegExp,
    limpiar?: (s: string) => string | null,
  ): string | null {
    const m = texto.match(re);
    if (!m) return null;
    const v = (m[1] ?? "").replace(/\s+/g, " ").trim();
    if (limpiar) {
      const l = limpiar(v);
      return l && l.trim() ? l.trim() : null;
    }
    return v || null;
  }

  parsear(ocr: string): ExtraccionSuelo {
    const lineas = ocr.split("\n");
    const plano = ocr.replace(/\s+/g, " ");

    const fechaRecepcion =
      this.campo(plano, /fecha\s+(?:de\s+)?recepci[oó]n:\s*([\d/]+)/i, (s) =>
        this.extraerFechaEs(s),
      ) ?? null;
    const fechaEmision =
      this.campo(plano, /fecha\s+(?:de\s+)?emisi[oó]n:\s*([\d/]+)/i, (s) =>
        this.extraerFechaEs(s),
      ) ?? null;

    const cabecera = {
      laboratorio: /suelo\s*-?\s*fertil/i.test(plano)
        ? "Laboratorio SUELOFERTIL"
        : null,
      nroAnalisis: this.campo(
        plano,
        /an[áa]lisis\s*n\s*[%°ºo:]?\s*:?\s*([\w/.-]+)/i,
        (s) => s.split(/\s/)[0].replace(/[^\w/.-]/g, ""),
      ),
      fechaRecepcion,
      fechaEmision,
      profundidad: this.campo(plano, /profundidad:\s*([\d\s\-–]*cm)/i, (s) =>
        s.replace(/\s*-\s*/g, "-"),
      ),
      muestra: this.campo(
        plano,
        /muestra\/s:\s*([^]*?)\s+(direcci[oó]n|fecha|qr|tel[eé]fono)/i,
        (s) =>
          s
            .split(/\s+/)
            .filter((t) => t && t !== "/" && t !== "|")
            .join(" "),
      ),
      productorTexto: this.campo(
        plano,
        /productor:\s*(.+?)\s+establecimiento:/i,
      ),
      loteTexto: this.campo(
        plano,
        /lote:\s*(.+?)\s+(qr:|tel[eé]fono|tel:|campo|latitud|muestra)/i,
      ),
    };

    const detalles: DetalleExtraido[] = [];
    const noDetectados: string[] = [];

    // Dueño de cada línea (primer parámetro que matchea, en orden de
    // catálogo): las líneas de otra fila se excluyen de la ventana para que
    // un valor no se asigne dos veces.
    const duenio: (string | null)[] = lineas.map((linea) => {
      const inicio = this.norm(linea).slice(0, 64);
      return (
        PARAMETROS_SUELO.find((p) => p.claves.some((c) => inicio.includes(c)))
          ?.codigo ?? null
      );
    });

    // En orden de documento: el valor se asigna a la etiqueta más cercana y
    // los tokens consumidos no se reutilizan en filas vecinas.
    const ordenados = PARAMETROS_SUELO.map((p) => ({
      p,
      idx: this.primeraLineaConEtiqueta(lineas, p.claves),
    }))
      .filter((o) => o.idx >= 0)
      .sort((a, b) => a.idx - b.idx);
    for (const p of PARAMETROS_SUELO) {
      if (!ordenados.some((o) => o.p === p)) noDetectados.push(p.etiqueta);
    }
    const consumidos = new Set<string>();
    for (const { p, idx } of ordenados) {
      // La etiqueta puede partirse en 2 líneas y el valor quedar en la
      // adyacente: ventana [i-1, i+1], sin líneas de otra fila.
      const ventana = [idx - 1, idx, idx + 1]
        .filter(
          (j) =>
            j >= 0 &&
            j < lineas.length &&
            (duenio[j] === null || duenio[j] === p.codigo),
        )
        .map((j) => lineas[j])
        .join(" ");
      const normVentana = this.norm(ventana);

      if (p.tipo === "texto" || p.tipo === "numero_o_texto") {
        if (/no\s*salino/.test(normVentana)) {
          detalles.push({
            codigo: p.codigo,
            etiqueta: p.etiqueta,
            valorNum: null,
            valorTexto: "No Salino",
            unidad: null,
            metodo: p.metodo,
          });
          continue;
        }
        if (p.tipo === "texto" && /\bsalino\b/.test(normVentana)) {
          detalles.push({
            codigo: p.codigo,
            etiqueta: p.etiqueta,
            valorNum: null,
            valorTexto: "Salino",
            unidad: null,
            metodo: p.metodo,
          });
          continue;
        }
      }

      const tokens = this.tokenizarVentana(ventana).filter(
        (t) => !consumidos.has(t),
      );
      const encontrado = this.buscarValor(
        tokens,
        UNIDADES_PLAUSIBLES[p.codigo] ?? null,
      );
      const { valor, unidad } = encontrado;
      if (valor === null) {
        noDetectados.push(p.etiqueta);
        continue;
      }
      if (p.tipo === "ph" && (valor < 0 || valor > 14)) {
        noDetectados.push(p.etiqueta);
        continue;
      }
      detalles.push({
        codigo: p.codigo,
        etiqueta: p.etiqueta,
        valorNum: Math.round(valor * 10000) / 10000,
        valorTexto: null,
        unidad: unidad ?? p.unidad,
        metodo: p.metodo,
      });
      for (const t of encontrado.usados) consumidos.add(t);
    }

    return { ...cabecera, detalles, noDetectados };
  }
}
