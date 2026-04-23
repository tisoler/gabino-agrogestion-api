import { PartialType } from '@nestjs/swagger';
import { CreateCultivoDto } from './create-cultivo.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateCultivoDto extends PartialType(CreateCultivoDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
