import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Notificacion } from "../entities/notificacion.entity";
import { NotificacionesController } from "./notificaciones.controller";
import { NotificacionesService } from "./notificaciones.service";
import { FirebaseSseGuard } from "./guards/sse.guard";

@Module({
  imports: [TypeOrmModule.forFeature([Notificacion])],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, FirebaseSseGuard],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
