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
  @ApiProperty({
    description:
      "ID de la producción (campaña) monitoreada. Puede omitirse solo para borrador de audio sin lote resuelto.",
    required: false,
  })
  @IsOptional()
  @IsInt()
  idCampania?: number;

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

  @ApiPropertyOptional({
    description:
      "Estado inicial (default 'confirmado'; 'borrador' para flujo de voz)",
    enum: ["borrador", "confirmado"],
  })
  @IsOptional()
  @IsString()
  @Matches(/^(borrador|confirmado)$/, {
    message: "estado debe ser 'borrador' o 'confirmado'",
  })
  estado?: string;

  @ApiPropertyOptional({
    description: "Origen del registro",
    enum: ["manual", "audio_libre", "audio_lote"],
  })
  @IsOptional()
  @IsString()
  @Matches(/^(manual|audio_libre|audio_lote)$/, {
    message: "origen debe ser 'manual', 'audio_libre' o 'audio_lote'",
  })
  origen?: string;
}
