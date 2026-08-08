import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insumo } from '../entities/insumo.entity';
import { CategoriaInsumo } from '../entities/categoria-insumo.entity';
import { InsumosService } from './insumos.service';
import { InsumosController } from './insumos.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Insumo, CategoriaInsumo]),
    AuthModule,
  ],
  providers: [InsumosService],
  controllers: [InsumosController],
  exports: [InsumosService],
})
export class InsumosModule {}
