import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";

export class CreateCampaniaDto {
  @ApiProperty({
    description: "Período de la campaña (ej: 25/26)",
    example: "25/26",
  })
  @IsString()
  @Matches(/^\d{2}\/\d{2}$/)
  campania: string;

  @ApiProperty({ description: "ID del lote sobre el que se carga la campaña" })
  @Type(() => Number)
  @IsInt()
  idLote: number;

  @ApiPropertyOptional({
    description: "ID del productor (empresa) destino de la campaña",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idEmpresa?: number;

  @ApiProperty({ description: "ID del cultivo" })
  @Type(() => Number)
  @IsInt()
  idCultivo: number;

  @ApiPropertyOptional({ description: "ID de la variedad/híbrido" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idVariedad?: number;

  @ApiPropertyOptional({ description: "Superficie sembrada (ha)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supSembrada?: number;

  @ApiPropertyOptional({ description: "Superficie cosechada (ha)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supCosechada?: number;

  @ApiPropertyOptional({ description: "Producción neta total (qq)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  prodNetaTotalQq?: number;

  @ApiPropertyOptional({ description: "Precio por quintal ($/qq)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  precioXQq?: number;

  @ApiPropertyOptional({ description: "Alquiler en qq/ha" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  alquilerQqHa?: number;

  @ApiPropertyOptional({ description: "Comercialización en % (0-100)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  comercializacionPct?: number;

  @ApiPropertyOptional({ description: "Costo de cosecha en $/ha" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cosechaXHa?: number;
}
