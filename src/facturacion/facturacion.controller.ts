import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Roles as RolesConst } from "../constantes";
import { FacturacionService } from "./facturacion.service";
import { PizarraService } from "./pizarra.service";
import { UpdatePagoDto } from "./dto/update-pago.dto";
import { UpdateTarifaDto } from "./dto/update-tarifa.dto";
import { BalanceQueryDto } from "./dto/balance-query.dto";

/**
 * Monitor de balance de la app.
 *
 * Todo es solo sys-admin (como en `POST /cache/invalidate`), salvo
 * `GET /precios`: la pizarra CAC es dato público de mercado y alimenta el
 * widget del header para todos los usuarios autenticados.
 */
@ApiTags("facturacion")
@Controller("facturacion")
@UseGuards(FirebaseGuard, RolesGuard)
@ApiBearerAuth()
export class FacturacionController {
  constructor(
    private readonly facturacion: FacturacionService,
    private readonly pizarra: PizarraService,
  ) {}

  @Get("precios")
  @ApiOperation({
    summary:
      "Precios de pizarra CAC vigentes (scraping con cache de 6h en server)",
  })
  getPrecios() {
    return this.pizarra.getPizarra();
  }

  @Get("config")
  @Roles(RolesConst.SYS_ADMIN)
  @ApiOperation({ summary: "Tarifa base actual" })
  async getConfig() {
    return { tarifaBase: await this.facturacion.getTarifaBase() };
  }

  @Patch("config")
  @Roles(RolesConst.SYS_ADMIN)
  @ApiOperation({ summary: "Actualizar la tarifa base" })
  setConfig(@Body() dto: UpdateTarifaDto) {
    return this.facturacion.setTarifaBase(dto.tarifaBase);
  }

  @Get("balance")
  @Roles(RolesConst.SYS_ADMIN)
  @ApiOperation({
    summary:
      "Balance de producciones por empresa y dueño (por defecto, año actual)",
  })
  getBalance(@Query() query: BalanceQueryDto) {
    return this.facturacion.getBalance(query.desde, query.hasta);
  }

  @Patch("pagos/:idCampania")
  @Roles(RolesConst.SYS_ADMIN)
  @ApiOperation({
    summary:
      "Cambiar el estado de pago de una producción (congela precio y monto al pagar)",
  })
  setEstadoPago(
    @Param("idCampania", ParseIntPipe) idCampania: number,
    @Body() dto: UpdatePagoDto,
  ) {
    return this.facturacion.setEstadoPago(idCampania, dto.estado);
  }
}
