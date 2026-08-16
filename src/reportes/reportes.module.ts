import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Reporte } from "../entities/reporte.entity";
import { ReporteFila } from "../entities/reporte-fila.entity";
import { Empresa } from "../entities/empresa.entity";
import { Lote } from "../entities/lote.entity";
import { Cultivo } from "../entities/cultivo.entity";
import { Campania } from "../entities/campania.entity";
import { ReportesController } from "./reportes.controller";
import { ReportesService } from "./reportes.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reporte,
      ReporteFila,
      Empresa,
      Lote,
      Cultivo,
      Campania,
    ]),
    AuthModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
