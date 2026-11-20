import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAseguradoraDto {
  @ApiPropertyOptional({ description: "Nombre de la empresa de seguros" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({ description: "Activa / inactiva" })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
