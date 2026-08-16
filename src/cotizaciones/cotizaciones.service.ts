import { BadRequestException, Injectable } from "@nestjs/common";

export interface CotizacionDolar {
  casa: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
  actualizadoEn: string;
}

interface CacheEntry {
  valor: CotizacionDolar;
  expira: number;
}

@Injectable()
export class CotizacionesService {
  private readonly URL = "https://dolarapi.com/v1/dolares/mayorista";
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hora
  private cache = new Map<string, CacheEntry>();

  async getDolarBNA(): Promise<CotizacionDolar> {
    const ahora = Date.now();
    const cached = this.cache.get("bna");

    if (cached && cached.expira > ahora) {
      return cached.valor;
    }

    try {
      const res = await fetch(this.URL);
      if (!res.ok) throw new Error(`dolarapi respondió ${res.status}`);
      const data = await res.json();

      const valor: CotizacionDolar = {
        casa: data?.casa ?? "mayorista",
        compra: Number(data?.compra) || 0,
        venta: Number(data?.venta) || 0,
        fechaActualizacion:
          data?.fechaActualizacion ?? new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      this.cache.set("bna", { valor, expira: ahora + this.TTL_MS });
      return valor;
    } catch {
      // Si falla la llamada pero hay cache previo, se devuelve (podría estar vencido).
      if (cached) return cached.valor;
      throw new BadRequestException(
        "No se pudo obtener la cotización del dólar",
      );
    }
  }
}
