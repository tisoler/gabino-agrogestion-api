import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class LineaSugeridaDto {
  @ApiPropertyOptional({ description: "ID del insumo si se resolvió" })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  idInsumo?: number | null;

  @ApiPropertyOptional({ description: "Nombre detectado en el audio" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({ description: "Dosis por ha si se entendió" })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cantidadPorHa?: number | null;

  @ApiPropertyOptional({ description: "Unidad detectada (ej: l/ha, cc/ha)" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unidad?: string | null;
}
