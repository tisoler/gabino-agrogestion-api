import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { MonitoreoLote } from "../entities/monitoreo-lote.entity";
import { Campania } from "../entities/campania.entity";
import { MonitoreosController } from "./monitoreos.controller";
import { MonitoreosService } from "./monitoreos.service";

@Module({
  imports: [TypeOrmModule.forFeature([MonitoreoLote, Campania]), AuthModule],
  controllers: [MonitoreosController],
  providers: [MonitoreosService],
  exports: [MonitoreosService],
})
export class MonitoreosModule {}
