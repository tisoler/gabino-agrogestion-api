import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Prescripcion } from "../entities/prescripcion.entity";
import { PrescripcionInsumo } from "../entities/prescripcion-insumo.entity";
import { Campania } from "../entities/campania.entity";
import { Lote } from "../entities/lote.entity";
import { Labor } from "../entities/labor.entity";
import { Insumo } from "../entities/insumo.entity";
import { CampaniaLabor } from "../entities/campania-labor.entity";
import { CampaniaInsumo } from "../entities/campania-insumo.entity";
import { PrescripcionesController } from "./prescripciones.controller";
import { PrescripcionesService } from "./prescripciones.service";
import { AuthModule } from "../auth/auth.module";
import { NotificacionesModule } from "../notificaciones/notificaciones.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescripcion,
      PrescripcionInsumo,
      Campania,
      Lote,
      Labor,
      Insumo,
      CampaniaLabor,
      CampaniaInsumo,
    ]),
    AuthModule,
    NotificacionesModule,
  ],
  controllers: [PrescripcionesController],
  providers: [PrescripcionesService],
  exports: [PrescripcionesService],
})
export class PrescripcionesModule {}
