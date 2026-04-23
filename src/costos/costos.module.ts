import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Costo } from '../entities/costo.entity';
import { CostosService } from './costos.service';
import { CostosController } from './costos.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Costo]),
    AuthModule,
  ],
  providers: [CostosService],
  controllers: [CostosController],
  exports: [CostosService],
})
export class CostosModule {}
