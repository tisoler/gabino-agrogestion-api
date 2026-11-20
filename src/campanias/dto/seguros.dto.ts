import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class GuardarSegurosDto {
  @ApiProperty({ description: "IDs de producciones incluidas en la planilla" })
  @IsInt({ each: true })
  ids: number[];

  @ApiPropertyOptional({
    description:
      "Quintales a asegurar por id de producción. Solo se actualizan los ids presentes (ausente = no se toca, vacío = se borra).",
    example: { 12: 30, 13: 15 },
  })
  @IsOptional()
  @IsObject()
  qq?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "Fecha de siembra (YYYY-MM-DD) por id de producción. Solo se actualizan los ids presentes (ausente = no se toca, vacío = se borra).",
  })
  @IsOptional()
  @IsObject()
  fechaSiembra?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "Variedad/híbrido por id de producción (debe pertenecer al cultivo de la producción). Solo se actualizan los ids presentes (ausente = no se toca, vacío = se borra).",
  })
  @IsOptional()
  @IsObject()
  idVariedad?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "ID de la empresa de seguros" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  aseguradoraId?: number;
}

export class DescargarSegurosDto extends GuardarSegurosDto {
  @ApiProperty({ description: "ID de la empresa de seguros" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  aseguradoraId: number;

  @ApiPropertyOptional({
    description: "Formato del archivo",
    enum: ["csv", "xls"],
    default: "xls",
  })
  @IsOptional()
  @IsString()
  @IsIn(["csv", "xls"])
  formato?: "csv" | "xls";
}

export class CompartirSegurosDto extends GuardarSegurosDto {
  @ApiProperty({ description: "ID de la empresa de seguros" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  aseguradoraId: number;
}
