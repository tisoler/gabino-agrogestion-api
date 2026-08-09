import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCampoDto {
  @ApiProperty({ description: 'Nombre del campo' })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'ID de la empresa del campo' })
  @Type(() => Number)
  @IsInt()
  idEmpresa: number;

  @ApiPropertyOptional({ description: 'Descripción del campo' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
