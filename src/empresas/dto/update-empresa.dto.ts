import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class UpdateEmpresaDto {
  @ApiProperty({ description: "Nuevo nombre de la empresa" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  nombre: string;
}
