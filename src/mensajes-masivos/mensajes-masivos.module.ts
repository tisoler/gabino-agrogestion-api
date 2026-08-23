import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MensajeMasivo } from "../entities/mensaje-masivo.entity";
import { Campania } from "../entities/campania.entity";
import { Lote } from "../entities/lote.entity";
import { Cultivo } from "../entities/cultivo.entity";
import { Empresa } from "../entities/empresa.entity";
import { MensajesMasivosController } from "./mensajes-masivos.controller";
import { MensajesMasivosService } from "./mensajes-masivos.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([MensajeMasivo, Campania, Lote, Cultivo, Empresa]),
    AuthModule,
  ],
  controllers: [MensajesMasivosController],
  providers: [MensajesMasivosService],
  exports: [MensajesMasivosService],
})
export class MensajesMasivosModule {}
