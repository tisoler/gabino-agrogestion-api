import { PartialType } from '@nestjs/swagger';
import { CreateLoteDto } from './create-lote.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateLoteDto extends PartialType(CreateLoteDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
