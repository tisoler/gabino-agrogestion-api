import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Labor } from '../entities/labor.entity';
import { LaboresService } from './labores.service';
import { LaboresController } from './labores.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Labor]),
    AuthModule,
  ],
  providers: [LaboresService],
  controllers: [LaboresController],
  exports: [LaboresService],
})
export class LaboresModule {}
