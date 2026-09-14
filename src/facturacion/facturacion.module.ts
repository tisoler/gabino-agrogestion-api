import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Campania } from "../entities/campania.entity";
import { FacturacionConfig } from "../entities/facturacion-config.entity";
import { PrecioPizarra } from "../entities/precio-pizarra.entity";
import { ProduccionPago } from "../entities/produccion-pago.entity";
import { FacturacionController } from "./facturacion.controller";
import { FacturacionService } from "./facturacion.service";
import { PizarraService } from "./pizarra.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campania,
      FacturacionConfig,
      PrecioPizarra,
      ProduccionPago,
    ]),
    AuthModule,
  ],
  providers: [FacturacionService, PizarraService],
  controllers: [FacturacionController],
  exports: [FacturacionService, PizarraService],
})
export class FacturacionModule {}
