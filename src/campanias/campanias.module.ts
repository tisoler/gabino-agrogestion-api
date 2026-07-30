import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campania } from '../entities/campania.entity';
import { CampaniaLabor } from '../entities/campania-labor.entity';
import { CampaniaInsumo } from '../entities/campania-insumo.entity';
import { CampaniaCosto } from '../entities/campania-costo.entity';
import { Lote } from '../entities/lote.entity';
import { Labor } from '../entities/labor.entity';
import { Insumo } from '../entities/insumo.entity';
import { Costo } from '../entities/costo.entity';
import { Cultivo } from '../entities/cultivo.entity';
import { Variedad } from '../entities/variedad.entity';
import { CampaniasController } from './campanias.controller';
import { CampaniasService } from './campanias.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campania,
      CampaniaLabor,
      CampaniaInsumo,
      CampaniaCosto,
      Lote,
      Labor,
      Insumo,
      Costo,
      Cultivo,
      Variedad,
    ]),
    AuthModule,
  ],
  controllers: [CampaniasController],
  providers: [CampaniasService],
  exports: [CampaniasService],
})
export class CampaniasModule {}
