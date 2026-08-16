import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional } from "class-validator";

export class CreateCategoriaInsumoDto {
  @ApiProperty({ description: "Nombre de la categoría" })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: "Descripción de la categoría" })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
