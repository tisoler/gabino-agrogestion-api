import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Campania } from "../entities/campania.entity";
import { FacturacionConfig } from "../entities/facturacion-config.entity";
import { ProduccionPago } from "../entities/produccion-pago.entity";
import {
  PizarraService,
  cerealDeCultivo,
  normalizarNombre,
  type PrecioCereal,
} from "./pizarra.service";

export const CLAVE_TARIFA_BASE = "tarifa_base";
export const TARIFA_BASE_DEFAULT = 30000;
/** Fracción del precio de pizarra ($/Tn) que se cobra por producción (~1 qq). */
export const FACTOR_PIZARRA = 0.1;

export interface ProduccionBalance {
  idCampania: number;
  periodo: string;
  lote: string;
  cultivo: string;
  creadoEn: Date;
  estado: "pendiente" | "pagado";
  /** Monto a cobrar (pendiente: cálculo en vivo; pagado: snapshot). */
  monto: number;
  /** Precio de pizarra usado. NULL si se aplicó tarifa base. */
  precioReferencia: number | null;
  usoTarifaBase: boolean;
  fechaPago: Date | null;
}

export interface DuenoBalance {
  idUsuario: string;
  nombre: string;
  email: string;
  aCobrar: number;
  cobrado: number;
  producciones: ProduccionBalance[];
}

export interface EmpresaBalance {
  idEmpresa: number;
  nombre: string;
  aCobrar: number;
  cobrado: number;
  duenos: DuenoBalance[];
}

export interface Balance {
  desde: string;
  hasta: string;
  tarifaBase: number;
  fechaPizarra: string | null;
  tcBna: number | null;
  precios: PrecioCereal[];
  fuentePrecios: string;
  resumen: {
    aCobrar: number;
    cobrado: number;
    total: number;
    pendientes: number;
    pagados: number;
  };
  empresas: EmpresaBalance[];
}

@Injectable()
export class FacturacionService {
  constructor(
    @InjectRepository(Campania) private campaniaRepo: Repository<Campania>,
    @InjectRepository(ProduccionPago)
    private pagoRepo: Repository<ProduccionPago>,
    @InjectRepository(FacturacionConfig)
    private configRepo: Repository<FacturacionConfig>,
    private pizarra: PizarraService,
  ) {}

  /** "Maíz" → "maiz". Ver `normalizarNombre` (pizarra.service). */
  static normalizarCultivo(nombre: string): string {
    return normalizarNombre(nombre);
  }

  async getTarifaBase(): Promise<number> {
    const row = await this.configRepo.findOne({
      where: { clave: CLAVE_TARIFA_BASE },
    });
    const v = row != null ? Number(row.valor) : NaN;
    return Number.isFinite(v) && v > 0 ? v : TARIFA_BASE_DEFAULT;
  }

  async setTarifaBase(valor: number): Promise<{ tarifaBase: number }> {
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new BadRequestException("La tarifa base debe ser mayor a 0");
    }
    await this.configRepo.upsert({ clave: CLAVE_TARIFA_BASE, valor }, [
      "clave",
    ]);
    return { tarifaBase: valor };
  }

  /**
   * Balance de producciones agrupado por empresa → dueño.
   * Filtra por `campania.created_at` (por defecto el año actual).
   */
  async getBalance(desde?: string, hasta?: string): Promise<Balance> {
    const { desdeDate, hastaDate } = this.resolverRango(desde, hasta);
    const [pizarra, tarifaBase] = await Promise.all([
      this.pizarra.getPizarra(),
      this.getTarifaBase(),
    ]);
    const mapaPrecios = new Map(pizarra.precios.map((p) => [p.cultivo, p]));

    const filas = await this.campaniaRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.lote", "lote")
      .leftJoinAndSelect("lote.empresa", "empresa")
      .leftJoinAndSelect("c.cultivo", "cultivo")
      .leftJoin("produccion_pago", "pago", "pago.id_campania = c.id")
      .addSelect(["pago.id", "pago.estado", "pago.monto"])
      .where("c.activo = true")
      .andWhere("c.created_at >= :desde", { desde: desdeDate })
      .andWhere("c.created_at <= :hasta", { hasta: hastaDate })
      .orderBy("empresa.nombre", "ASC")
      .addOrderBy("lote.nombre_usuario", "ASC")
      .addOrderBy("c.created_at", "DESC")
      .getMany();

    // Pagos indexados por campaña (el addSelect no los mapea a la entidad).
    const pagosRaw: {
      id_campania: number;
      estado: string;
      monto: string | null;
      precio_referencia: string | null;
      uso_tarifa_base: boolean;
      fecha_pago: Date | null;
    }[] = await this.campaniaRepo.query(
      `SELECT p.id_campania, p.estado, p.monto, p.precio_referencia,
              p.uso_tarifa_base, p.fecha_pago
       FROM produccion_pago p
       INNER JOIN campania c ON c.id = p.id_campania
       WHERE c.activo = true AND c.created_at >= $1 AND c.created_at <= $2`,
      [desdeDate, hastaDate],
    );
    const pagos = new Map(pagosRaw.map((p) => [Number(p.id_campania), p]));

    const empresas = new Map<number, EmpresaBalance>();
    let aCobrar = 0;
    let cobrado = 0;
    let pendientes = 0;
    let pagados = 0;

    for (const c of filas) {
      const pago = pagos.get(c.id);
      const estado = pago?.estado === "pagado" ? "pagado" : "pendiente";
      let monto: number;
      let precioReferencia: number | null;
      let usoTarifaBase: boolean;
      let fechaPago: Date | null = null;
      if (estado === "pagado") {
        if (pago?.monto != null) {
          // Snapshot histórico congelado al momento del pago.
          monto = Number(pago.monto);
          precioReferencia =
            pago.precio_referencia != null
              ? Number(pago.precio_referencia)
              : null;
          usoTarifaBase = pago.uso_tarifa_base;
          fechaPago = pago.fecha_pago;
        } else {
          // Fila de pago sin snapshot (dato previo): se muestra el cálculo
          // vivo como referencia, puede diferir del monto cobrado.
          const calc = this.calcularMonto(
            c.cultivo?.nombre ?? "",
            mapaPrecios,
            tarifaBase,
          );
          monto = calc.monto;
          precioReferencia = calc.precioReferencia;
          usoTarifaBase = calc.usoTarifaBase;
        }
        cobrado += monto;
        pagados += 1;
      } else {
        const calc = this.calcularMonto(
          c.cultivo?.nombre ?? "",
          mapaPrecios,
          tarifaBase,
        );
        monto = calc.monto;
        precioReferencia = calc.precioReferencia;
        usoTarifaBase = calc.usoTarifaBase;
        aCobrar += monto;
        pendientes += 1;
      }

      const idEmpresa = c.lote?.idEmpresa ?? 0;
      let empresa = empresas.get(idEmpresa);
      if (!empresa) {
        empresa = {
          idEmpresa,
          nombre: c.lote?.empresa?.nombre ?? `Empresa #${idEmpresa}`,
          aCobrar: 0,
          cobrado: 0,
          duenos: [],
        };
        empresas.set(idEmpresa, empresa);
      }
      const uid = c.lote?.idUsuario ?? "sin-dueno";
      let dueno = empresa.duenos.find((d) => d.idUsuario === uid);
      if (!dueno) {
        dueno = {
          idUsuario: uid,
          nombre: c.lote?.nombreUsuario?.trim() || c.lote?.emailUsuario || uid,
          email: c.lote?.emailUsuario ?? "",
          aCobrar: 0,
          cobrado: 0,
          producciones: [],
        };
        empresa.duenos.push(dueno);
      }
      const prod: ProduccionBalance = {
        idCampania: c.id,
        periodo: c.campania,
        lote: c.lote?.descripcion?.trim() || `Lote #${c.idLote}`,
        cultivo: c.cultivo?.nombre ?? `#${c.idCultivo}`,
        creadoEn: c.createdAt,
        estado,
        monto: Math.round(monto * 100) / 100,
        precioReferencia,
        usoTarifaBase,
        fechaPago,
      };
      dueno.producciones.push(prod);
      if (estado === "pagado") {
        dueno.cobrado += prod.monto;
        empresa.cobrado += prod.monto;
      } else {
        dueno.aCobrar += prod.monto;
        empresa.aCobrar += prod.monto;
      }
    }

    const redondear = (n: number) => Math.round(n * 100) / 100;
    for (const e of empresas.values()) {
      e.aCobrar = redondear(e.aCobrar);
      e.cobrado = redondear(e.cobrado);
      for (const d of e.duenos) {
        d.aCobrar = redondear(d.aCobrar);
        d.cobrado = redondear(d.cobrado);
      }
    }

    return {
      desde: desdeDate.toISOString().slice(0, 10),
      hasta: hastaDate.toISOString().slice(0, 10),
      tarifaBase,
      fechaPizarra: pizarra.fechaPizarra,
      tcBna: pizarra.tcBna,
      precios: pizarra.precios,
      fuentePrecios: pizarra.fuente,
      resumen: {
        aCobrar: redondear(aCobrar),
        cobrado: redondear(cobrado),
        total: redondear(aCobrar + cobrado),
        pendientes,
        pagados,
      },
      empresas: [...empresas.values()],
    };
  }

  /**
   * Cambia el estado de pago de una producción. Al pasar a "pagado" congela
   * el precio de referencia y el monto vigentes (registro histórico); al
   * volver a "pendiente" los limpia para recalcular en vivo.
   */
  async setEstadoPago(idCampania: number, estado: "pendiente" | "pagado") {
    const campania = await this.campaniaRepo.findOne({
      where: { id: idCampania },
      relations: { cultivo: true },
    });
    if (!campania) throw new NotFoundException("Producción no encontrada");

    let pago = await this.pagoRepo.findOne({ where: { idCampania } });
    if (!pago) {
      pago = this.pagoRepo.create({ idCampania, estado: "pendiente" });
    }
    if (estado === "pagado") {
      const [mapa, tarifaBase] = await Promise.all([
        this.pizarra.getMapaPrecios(),
        this.getTarifaBase(),
      ]);
      const calc = this.calcularMonto(
        campania.cultivo?.nombre ?? "",
        mapa,
        tarifaBase,
      );
      pago.estado = "pagado";
      pago.precioReferencia = calc.precioReferencia;
      pago.usoTarifaBase = calc.usoTarifaBase;
      pago.monto = Math.round(calc.monto * 100) / 100;
      pago.fechaPago = new Date();
    } else {
      pago.estado = "pendiente";
      pago.precioReferencia = null;
      pago.usoTarifaBase = false;
      pago.monto = null;
      pago.fechaPago = null;
    }
    const saved = await this.pagoRepo.save(pago);
    return {
      idCampania,
      estado: saved.estado,
      monto: saved.monto != null ? Number(saved.monto) : null,
      precioReferencia:
        saved.precioReferencia != null ? Number(saved.precioReferencia) : null,
      usoTarifaBase: saved.usoTarifaBase,
      fechaPago: saved.fechaPago,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private calcularMonto(
    cultivoNombre: string,
    mapaPrecios: Map<string, PrecioCereal>,
    tarifaBase: number,
  ): {
    monto: number;
    precioReferencia: number | null;
    usoTarifaBase: boolean;
  } {
    const clave = cerealDeCultivo(cultivoNombre);
    const precio = clave != null ? mapaPrecios.get(clave) : undefined;
    if (precio && !precio.sinCotizacion && precio.precioArs > 0) {
      return {
        monto: precio.precioArs * FACTOR_PIZARRA,
        precioReferencia: precio.precioArs,
        usoTarifaBase: false,
      };
    }
    return { monto: tarifaBase, precioReferencia: null, usoTarifaBase: true };
  }

  private resolverRango(
    desde?: string,
    hasta?: string,
  ): {
    desdeDate: Date;
    hastaDate: Date;
  } {
    const anio = new Date().getFullYear();
    const desdeDate = desde
      ? new Date(`${desde}T00:00:00`)
      : new Date(anio, 0, 1);
    const hastaDate = hasta
      ? new Date(`${hasta}T23:59:59.999`)
      : new Date(anio, 11, 31, 23, 59, 59, 999);
    if (
      Number.isNaN(desdeDate.getTime()) ||
      Number.isNaN(hastaDate.getTime())
    ) {
      throw new BadRequestException("Rango de fechas inválido (YYYY-MM-DD)");
    }
    return { desdeDate, hastaDate };
  }
}
