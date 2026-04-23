import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateVariedadDto {
  @ApiProperty({ description: 'ID del cultivo' })
  @IsNotEmpty()
  @IsNumber()
  idCultivo: number;

  @ApiProperty({ description: 'Nombre de la variedad' })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'ID de la empresa' })
  @IsOptional()
  @IsNumber()
  idEmpresa?: number;
}
