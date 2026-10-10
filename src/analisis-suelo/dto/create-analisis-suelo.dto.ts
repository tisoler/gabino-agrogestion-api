import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class CreateAnalisisSueloDetalleDto {
  @ApiProperty({
    description: "Código normalizado del parámetro (ej. materia_organica)",
  })
  @IsString()
  @MaxLength(60)
  parametro: string;

  @ApiProperty({ description: "Etiqueta legible del parámetro" })
  @IsString()
  @MaxLength(200)
  etiqueta: string;

  @ApiPropertyOptional({ description: "Valor numérico (si aplica)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorNum?: number | null;

  @ApiPropertyOptional({
    description: 'Valor texto (ej. conductividad "No Salino")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  valorTexto?: string | null;

  @ApiPropertyOptional({ description: "Unidad (ej. g/kg, mg/kg)" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unidad?: string | null;

  @ApiPropertyOptional({ description: "Metodología informada" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  metodo?: string | null;
}

export class CreateAnalisisSueloDto {
  @ApiPropertyOptional({ description: "Laboratorio" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  laboratorio?: string | null;

  @ApiPropertyOptional({ description: "Número de análisis del laboratorio" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nroAnalisis?: string | null;

  @ApiPropertyOptional({ description: "Fecha de recepción (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  fechaRecepcion?: string | null;

  @ApiPropertyOptional({ description: "Fecha de emisión (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  fechaEmision?: string | null;

  @ApiPropertyOptional({ description: "Profundidad (ej. 000-020 cm)" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  profundidad?: string | null;

  @ApiPropertyOptional({ description: "Muestra" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  muestra?: string | null;

  @ApiProperty({
    description: "Determinaciones con valor (al menos una)",
    type: [CreateAnalisisSueloDetalleDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAnalisisSueloDetalleDto)
  detalles: CreateAnalisisSueloDetalleDto[];
}
