import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateUserCelularDto {
  @ApiPropertyOptional({
    description:
      "Celular en formato internacional (ej: +5491122334455). " +
      "Enviar string vacío para borrarlo.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  celular?: string;
}
