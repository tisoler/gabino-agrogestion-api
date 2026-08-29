import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class UpdateUserNombreDto {
  @ApiProperty({
    description:
      "Nombre del usuario (se guarda en Firestore, colección usuarios)",
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  nombre: string;
}
