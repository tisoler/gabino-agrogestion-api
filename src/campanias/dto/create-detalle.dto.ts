import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCampaniaDetalleLaborDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  idLabor: number;

  @ApiProperty({ description: 'Fecha de la labor (YYYY-MM-DD)' })
  @IsString()
  fecha: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  superficieLaboreada: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  costoLaborHa: number;
}

export class CreateCampaniaDetalleInsumoDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  idInsumo: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  unidadesHa: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  costoUnidad: number;
}

export class CreateCampaniaDetalleCostoDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  idCosto: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  unidadesHa: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  costoUnidad: number;
}
