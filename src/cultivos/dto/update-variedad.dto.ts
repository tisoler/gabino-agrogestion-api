import { PartialType } from '@nestjs/swagger';
import { CreateVariedadDto } from './create-variedad.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateVariedadDto extends PartialType(CreateVariedadDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
