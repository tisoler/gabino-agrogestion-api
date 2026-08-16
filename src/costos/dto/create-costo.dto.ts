import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsIn,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCostoDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({
    required: false,
    description: "Precio unitario de referencia",
  })
  @IsNumber()
  @IsOptional()
  precioUnitario?: number;

  @ApiProperty({
    required: false,
    description: "Unidad de medida del precio",
    enum: ["ton", "kg", "lt", "unidad", "ha", "hr"],
  })
  @IsString()
  @IsOptional()
  @IsIn(["ton", "kg", "lt", "unidad", "ha", "hr"])
  unidad?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  idEmpresa?: number;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
