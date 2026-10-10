import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class UpdateMonitoreoDto {
  @ApiPropertyOptional({ description: "Fecha de la observación (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiPropertyOptional({ description: "Hora de la observación (HH:mm)" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: "hora debe tener formato HH:mm",
  })
  hora?: string;

  @ApiPropertyOptional({ description: "Diagnóstico del lote" })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnostico?: string;

  @ApiPropertyOptional({ description: "Comentarios / observaciones" })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}
