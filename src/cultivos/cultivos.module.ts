import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cultivo } from '../entities/cultivo.entity';
import { Variedad } from '../entities/variedad.entity';
import { CultivosService } from './cultivos.service';
import { CultivosController } from './cultivos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cultivo, Variedad])],
  controllers: [CultivosController],
  providers: [CultivosService],
  exports: [CultivosService],
})
export class CultivosModule {}
