import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campo } from '../entities/campo.entity';
import { CamposService } from './campos.service';
import { CamposController } from './campos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Campo])],
  controllers: [CamposController],
  providers: [CamposService],
  exports: [CamposService],
})
export class CamposModule {}
