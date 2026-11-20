import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class CreateAseguradoraDto {
  @ApiProperty({ description: "Nombre de la empresa de seguros" })
  @IsString()
  @MaxLength(200)
  nombre: string;
}
