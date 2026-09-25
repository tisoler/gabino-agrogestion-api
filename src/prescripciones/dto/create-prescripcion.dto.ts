import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  Min,
} from "class-validator";

export class CreatePrescripcionInsumoDto {
  @ApiProperty({ description: "ID del insumo" })
  @Type(() => Number)
  @IsInt()
  idInsumo: number;

  @ApiProperty({ description: "Cantidad por hectárea" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidadPorHa: number;

  @ApiProperty({
    description: "Cantidad total (cantidad_por_ha * total_ha_aplicacion)",
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidadTotal: number;
}

export class CreatePrescripcionLoteDto {
  @ApiProperty({ description: "ID de la producción (campaña+lote) del lote" })
  @Type(() => Number)
  @IsInt()
  idCampania: number;

  @ApiProperty({
    description: "Hectáreas a aplicar en este lote",
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  superficieAplicada: number;
}

export class CreatePrescripcionDto {
  @ApiProperty({ description: "Fecha de la prescripción (YYYY-MM-DD)" })
  @IsDateString()
  fecha: string;

  @ApiProperty({ description: "ID de la labor prescripta" })
  @Type(() => Number)
  @IsInt()
  idLabor: number;

  @ApiProperty({
    description:
      "Lotes (producciones) de la prescripción, cada uno con su superficie. El total de ha se deriva de la suma.",
    type: [CreatePrescripcionLoteDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescripcionLoteDto)
  lotes: CreatePrescripcionLoteDto[];

  @ApiPropertyOptional({
    description: "Indicaciones sobre la labor a realizar (opcional)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({
    description: "Insumos a aplicar (1 o varios)",
    type: [CreatePrescripcionInsumoDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePrescripcionInsumoDto)
  insumos?: CreatePrescripcionInsumoDto[];
}
