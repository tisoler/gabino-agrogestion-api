import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Aseguradora } from "../entities/aseguradora.entity";
import { AseguradorasController } from "./aseguradoras.controller";
import { AseguradorasService } from "./aseguradoras.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [TypeOrmModule.forFeature([Aseguradora]), AuthModule],
  controllers: [AseguradorasController],
  providers: [AseguradorasService],
  exports: [AseguradorasService],
})
export class AseguradorasModule {}
