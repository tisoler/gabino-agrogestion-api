import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { MonitoreoLote } from "../entities/monitoreo-lote.entity";
import { Campania } from "../entities/campania.entity";
import { Lote } from "../entities/lote.entity";
import { MonitoreosController } from "./monitoreos.controller";
import { MonitoreosService } from "./monitoreos.service";
import { TranscripcionService } from "./transcripcion.service";
import { SpacesService } from "../spaces/spaces.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([MonitoreoLote, Campania, Lote]),
    AuthModule,
  ],
  controllers: [MonitoreosController],
  providers: [MonitoreosService, TranscripcionService, SpacesService],
  exports: [MonitoreosService],
})
export class MonitoreosModule {}
