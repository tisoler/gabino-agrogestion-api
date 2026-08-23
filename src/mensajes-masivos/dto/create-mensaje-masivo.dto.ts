import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateMensajeMasivoDto {
  @ApiProperty({
    description:
      "Mensaje a enviar. El token nombre_usuario se reemplaza por el " +
      "nombre de cada destinatario en el FE al abrir cada chat.",
  })
  @IsString()
  @MaxLength(4000)
  mensaje: string;

  @ApiProperty({ description: "ID del cultivo que define los destinatarios" })
  @Type(() => Number)
  @IsInt()
  idCultivo: number;

  @ApiPropertyOptional({
    description:
      "Período de campaña para resolver la producción (ej: 26/27). " +
      "Si se omite, usa el período actual.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\/\d{2}$/)
  campania?: string;

  @ApiProperty({
    description: "UIDs de los destinatarios seleccionados en el FE",
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  uids: string[];
}
