import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Insumo } from "../entities/insumo.entity";
import { Roles } from "../constantes";
import { normalizar, similitud, palabras } from "./monitoreos.service";

export interface LineaSugerida {
  idInsumo: number | null;
  nombre: string;
  cantidadPorHa: number | null;
  unidad: string | null;
}

/** Raíces que anuncian una prescripción en el dictado. */
const RECETA_RE =
  /prescrib\w*|prescripci[oó]n|aplicar\b|aplica\b|aplicaci[oó]n/i;

/**
 * Parsea el texto transcripto de una nota de voz (spike receta):
 * divide diagnóstico/observaciones por palabras clave y extrae líneas de
 * prescripción (insumo por fuzzy + dosis/unidad por cercanía).
 * Todo con umbrales conservadores: lo dudoso queda para revisión web.
 */
@Injectable()
export class VozContenidoService {
  constructor(
    @InjectRepository(Insumo) private insumoRepo: Repository<Insumo>,
  ) {}

  /** Divide en diagnóstico/observaciones por marcadores de sección. */
  dividirSecciones(texto: string): {
    diagnostico: string;
    observaciones: string | null;
  } {
    const t = texto.trim();
    // Marcador válido: al inicio, tras fin de frase/línea o tras coma, con : opcional.
    const re = /(^|[\.\!\?\n,])\s*(diagn[oó]sticos?|observaciones?)\s*:?/gi;
    const marcas: { tipo: "diag" | "obs"; inicio: number; fin: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const palabra = m[2].toLowerCase();
      marcas.push({
        tipo: /^diagn/.test(palabra) ? "diag" : "obs",
        inicio: m.index + m[1].length,
        fin: m.index + m[0].length,
      });
      if (m[0].length === 0) re.lastIndex++;
    }
    if (marcas.length === 0) return { diagnostico: t, observaciones: null };

    const partes: { tipo: "diag" | "obs"; texto: string }[] = [];
    // Texto previo al primer marcador → diagnóstico (convención actual).
    const previo = t
      .slice(0, marcas[0].inicio)
      .trim()
      .replace(/[:\s,;.]+$/, "");
    if (previo) partes.push({ tipo: "diag", texto: previo });
    for (let i = 0; i < marcas.length; i++) {
      const finSeccion =
        i + 1 < marcas.length ? marcas[i + 1].inicio : t.length;
      const cuerpo = t
        .slice(marcas[i].fin, finSeccion)
        .trim()
        .replace(/[:,;.]+$/, "");
      if (cuerpo) partes.push({ tipo: marcas[i].tipo, texto: cuerpo });
    }
    const diag = partes
      .filter((p) => p.tipo === "diag")
      .map((p) => p.texto)
      .join(" ")
      .trim();
    const obs = partes
      .filter((p) => p.tipo === "obs")
      .map((p) => p.texto)
      .join(" ")
      .trim();
    return {
      diagnostico: diag || t,
      observaciones: obs || null,
    };
  }

  /**
   * Extrae líneas de prescripción del texto. Solo corre si hay palabra de
   * receta (prescribir/aplicar/...); si no, devuelve [].
   */
  async extraerLineas(
    texto: string,
    user: any,
  ): Promise<{ tieneReceta: boolean; lineas: LineaSugerida[] }> {
    const marca = texto.match(RECETA_RE);
    if (!marca || marca.index === undefined)
      return { tieneReceta: false, lineas: [] };
    const porcion = texto.slice(marca.index);
    const insumos = await this.insumosVisibles(user);
    const norm = normalizar(porcion);
    const tokens = new Set(palabras(norm));
    const candidatas: { insumo: Insumo; puntos: number }[] = [];
    for (const ins of insumos) {
      const nombre = normalizar(ins.nombre ?? "");
      if (!nombre) continue;
      let puntos = 0;
      if (mencionaPalabra(norm, nombre)) {
        puntos = 3;
      } else {
        // Palabras con dígitos sueltos ("2", "4" de "2,4 D") no cuentan solas.
        const relevantes = palabras(nombre).filter(
          (w) => w.length >= 4 || (/\d/.test(w) && w.length >= 2),
        );
        if (relevantes.length > 0) {
          const sims = relevantes.map((w) => mejorSimilitud(w, tokens));
          const mejor = Math.max(0, ...sims);
          if (mejor >= 0.85) puntos = 2;
          else if (mejor >= 0.7) puntos = 1;
        }
      }
      if (puntos >= 2) candidatas.push({ insumo: ins, puntos });
    }
    candidatas.sort((a, b) => b.puntos - a.puntos);
    // Dosis por cercanía a la mención (cada dosis se usa una vez): evita que
    // "2 litros ... 500 cc de cletodim" le asigne 2 litros al cletodim.
    const dosis = this.extraerDosis(porcion);
    const usadas = new Set<number>();
    const lineas: LineaSugerida[] = [];
    const menciones = candidatas
      .slice(0, 6)
      .map((c) => ({
        insumo: c.insumo,
        pos: this.indiceMencion(porcion.toLowerCase(), c.insumo.nombre),
      }))
      .sort((a, b) => a.pos - b.pos);
    for (const { insumo, pos } of menciones) {
      let elegida: { cantidad: number; unidad: string | null } | null = null;
      let elegidaIdx = -1;
      let mejorDist = Infinity;
      for (let i = 0; i < dosis.length; i++) {
        if (usadas.has(i)) continue;
        const d = dosis[i].pos - (pos >= 0 ? pos : 0);
        const dist = Math.abs(d);
        if (dist > 80) continue;
        // Empate: preferir la dosis anterior ("500 cc de cletodim").
        if (dist < mejorDist || (dist === mejorDist && d < 0)) {
          mejorDist = dist;
          elegida = dosis[i];
          elegidaIdx = i;
        }
      }
      if (elegidaIdx >= 0) usadas.add(elegidaIdx);
      lineas.push({
        idInsumo: insumo.id,
        nombre: insumo.nombre,
        cantidadPorHa: elegida?.cantidad ?? null,
        unidad: elegida?.unidad ?? insumo.unidad ?? null,
      });
    }
    return { tieneReceta: true, lineas };
  }

  /** Insumos que el asesor puede recetar: globales + de sus empresas. */
  private async insumosVisibles(user: any) {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN);
    const qb = this.insumoRepo.createQueryBuilder("i").where("i.activo = true");
    if (!isAdmin) {
      const ids: number[] = (user.idEmpresas || [])
        .map((e: any) => Number(e))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      if (ids.length === 0) {
        qb.andWhere("i.id_empresa IS NULL AND i.uid_propietario IS NULL");
      } else {
        qb.andWhere(
          "((i.id_empresa IS NULL AND i.uid_propietario IS NULL) OR (i.id_empresa IN (:...ids)))",
          { ids },
        );
      }
    }
    qb.orderBy("i.id", "ASC");
    return qb.getMany();
  }

  /**
   * Todas las dosis del texto con su posición: número + unidad opcional
   * ("2 litros", "500 cc", "1,5 kg", "20%"), con o sin "por hectárea".
   */
  private extraerDosis(
    texto: string,
  ): { cantidad: number; unidad: string | null; pos: number }[] {
    const out: { cantidad: number; unidad: string | null; pos: number }[] = [];
    const re =
      /(\d+(?:[.,]\d+)?)\s*(litros?|lts?|l\b|c\.?\s*c\.?|cm3|kilos?|kg\b|k\b|grs?|gramos?|g\b|%|por\s*ciento)?(\s*(?:por\s+hect[aá]rea|\/\s*ha|por\s+ha))?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      const cantidad = Number(m[1].replace(",", "."));
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
      out.push({
        cantidad,
        unidad: normalizarUnidad(m[2]),
        pos: m.index,
      });
      if (m[0].length === 0) re.lastIndex++;
    }
    return out;
  }

  /** Primera aparición del nombre (o su palabra más larga) en el texto. */
  private indiceMencion(lower: string, nombre: string): number {
    const n = normalizar(nombre);
    if (n && lower.includes(n)) return lower.indexOf(n);
    let mejor = -1;
    for (const w of palabras(n)) {
      if (w.length < 4) continue;
      const i = lower.indexOf(w);
      if (i >= 0 && (mejor < 0 || i < mejor)) mejor = i;
    }
    return mejor;
  }
}

/** ¿El nombre aparece como palabra(s) completa(s) en el texto normalizado? */
function mencionaPalabra(norm: string, nombre: string): boolean {
  const n = nombre.trim();
  if (n.length < 3) return false;
  return new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(
    norm,
  );
}

/** Mejor similitud de una palabra contra un conjunto de tokens. */
function mejorSimilitud(palabra: string, tokens: Set<string>): number {
  let mejor = 0;
  for (const t of tokens) {
    const s = similitud(palabra, t);
    if (s > mejor) mejor = s;
  }
  return mejor;
}

/** Normaliza unidades dictadas a las del catálogo (L, cc, kg, g, %). */
function normalizarUnidad(raw: string | undefined): string | null {
  if (!raw) return null;
  const u = raw.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  if (/^(l|lt|lts|litro|litros)$/.test(u)) return "L";
  if (/^(cc|cm3)$/.test(u)) return "cc";
  if (/^(kg|k|kilo|kilos)$/.test(u)) return "kg";
  if (/^(g|gr|grs|gramo|gramos)$/.test(u)) return "g";
  if (u === "%" || u === "porciento") return "%";
  return raw.trim().slice(0, 20) || null;
}
