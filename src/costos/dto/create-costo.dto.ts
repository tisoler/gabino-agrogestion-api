import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsIn,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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

  @ApiPropertyOptional({
    description:
      "Alcance: global (sólo sys-admin), asesor (todos sus productores) o empresa (default)",
    enum: ["global", "asesor", "empresa"],
  })
  @IsOptional()
  @IsIn(["global", "asesor", "empresa"])
  alcance?: "global" | "asesor" | "empresa";

  @ApiPropertyOptional({
    description: "UID del asesor (sólo sys-admin con alcance asesor)",
  })
  @IsOptional()
  @IsString()
  uidAsesor?: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
