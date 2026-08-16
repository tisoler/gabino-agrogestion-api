import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
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

export class CreatePrescripcionDto {
  @ApiProperty({ description: "Fecha de la prescripción (YYYY-MM-DD)" })
  @IsDateString()
  fecha: string;

  @ApiProperty({ description: "ID de la campaña a la que se aplica" })
  @Type(() => Number)
  @IsInt()
  idCampania: number;

  @ApiProperty({ description: "ID de la labor prescripta" })
  @Type(() => Number)
  @IsInt()
  idLabor: number;

  @ApiProperty({ description: "Total de hectáreas para la aplicación" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalHaAplicacion: number;

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
