import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class BootstrapUsuarioDto {
  @ApiPropertyOptional({
    description:
      "Celular en formato internacional (ej: +5491122334455). Opcional, se guarda en el documento del usuario en Firestore.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  celular?: string;
}
