import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCampaniaDto {
  @ApiProperty({ description: 'Nombre visible de la campaña' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nombre: string;

  @ApiProperty({ description: 'Año de inicio de la campaña (>= 1900)' })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  anioDesde: number;

  @ApiProperty({ description: 'Año de fin de la campaña (>= anioDesde)' })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  anioHasta: number;

  @ApiProperty({ description: 'ID del lote sobre el que se carga la campaña' })
  @Type(() => Number)
  @IsInt()
  idLote: number;

  @ApiProperty({ description: 'ID del cultivo' })
  @Type(() => Number)
  @IsInt()
  idCultivo: number;

  @ApiPropertyOptional({ description: 'ID de la variedad/híbrido' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idVariedad?: number;

  @ApiPropertyOptional({ description: 'Superficie sembrada (ha)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supSembrada?: number;

  @ApiPropertyOptional({ description: 'Superficie cosechada (ha)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supCosechada?: number;

  @ApiPropertyOptional({ description: 'Producción neta total (qq)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  prodNetaTotalQq?: number;

  @ApiPropertyOptional({ description: 'Precio por quintal ($/qq)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  precioXQq?: number;

  @ApiPropertyOptional({ description: 'Alquiler en qq/ha' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  alquilerQqHa?: number;

  @ApiPropertyOptional({ description: 'Comercialización en % (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  comercializacionPct?: number;

  @ApiPropertyOptional({ description: 'Costo de cosecha en $/ha' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cosechaXHa?: number;
}
