import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateMonitoreoDto {
  @ApiProperty({ description: "ID de la producción (campaña) monitoreada" })
  @IsInt()
  idCampania: number;

  @ApiProperty({ description: "Fecha de la observación (YYYY-MM-DD)" })
  @IsDateString()
  fecha: string;

  @ApiProperty({
    description: "Hora de la observación (HH:mm o HH:mm:ss)",
    example: "14:30",
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: "hora debe tener formato HH:mm",
  })
  hora: string;

  @ApiProperty({ description: "Diagnóstico del lote" })
  @IsString()
  @IsNotEmpty({ message: "diagnostico no puede estar vacío" })
  @MaxLength(5000)
  diagnostico: string;

  @ApiPropertyOptional({ description: "Comentarios / observaciones" })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}
