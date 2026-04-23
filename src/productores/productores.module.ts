import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Productor } from '../entities/productor.entity';
import { ProductoresService } from './productores.service';
import { ProductoresController } from './productores.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Productor]),
    AuthModule,
  ],
  providers: [ProductoresService],
  controllers: [ProductoresController],
  exports: [ProductoresService],
})
export class ProductoresModule {}
