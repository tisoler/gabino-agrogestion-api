import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
} from "class-validator";

export class CreateCultivoDto {
  @ApiProperty({ description: "Nombre del cultivo" })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: "Descripción del cultivo" })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    description: "Tipo de cosecha: fina o gruesa",
    enum: ["fina", "gruesa"],
  })
  @IsOptional()
  @IsIn(["fina", "gruesa"])
  tipoCosecha?: string;

  @ApiPropertyOptional({ description: "ID de la empresa" })
  @IsOptional()
  @IsNumber()
  idEmpresa?: number;
}
