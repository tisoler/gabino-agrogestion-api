import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CotizacionesService, CotizacionDolar } from "./cotizaciones.service";

@ApiTags("cotizaciones")
@Controller("cotizaciones")
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Get("dolar-bna")
  @ApiOperation({
    summary: "Cotización del dólar (con cache en memoria con TTL)",
  })
  getDolarBNA(): Promise<CotizacionDolar> {
    return this.cotizacionesService.getDolarBNA();
  }
}
