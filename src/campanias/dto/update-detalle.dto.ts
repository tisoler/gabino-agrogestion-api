import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateCampaniaDetalleLaborDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idLabor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fecha?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  superficieLaboreada?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costoLaborHa?: number;

  @ApiPropertyOptional({
    description: "Observaciones (p.ej. quién realizó la labor)",
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateCampaniaDetalleInsumoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idInsumo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unidadesHa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costoUnidad?: number;

  @ApiPropertyOptional({ description: "Superficie aplicada (ha)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  superficieAplicada?: number;
}

export class UpdateCampaniaDetalleCostoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCosto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unidadesHa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costoUnidad?: number;

  @ApiPropertyOptional({
    description: "Observaciones opcionales del costo",
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
