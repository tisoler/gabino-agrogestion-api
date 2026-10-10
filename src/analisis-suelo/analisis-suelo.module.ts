import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AnalisisSuelo } from "../entities/analisis-suelo.entity";
import { AnalisisSueloDetalle } from "../entities/analisis-suelo-detalle.entity";
import { Lote } from "../entities/lote.entity";
import { AnalisisSueloController } from "./analisis-suelo.controller";
import { AnalisisSueloService } from "./analisis-suelo.service";
import { SueloExtraccionService } from "./suelo-extraccion.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalisisSuelo, AnalisisSueloDetalle, Lote]),
    AuthModule,
  ],
  controllers: [AnalisisSueloController],
  providers: [AnalisisSueloService, SueloExtraccionService],
  exports: [AnalisisSueloService],
})
export class AnalisisSueloModule {}
