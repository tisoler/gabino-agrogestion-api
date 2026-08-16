import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateLoteDto {
  @ApiProperty({ description: "UID de Firebase del usuario dueño del lote" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  idUsuario: string;

  @ApiPropertyOptional({
    description: "Nombre del dueño del lote (denormalizado)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombreUsuario?: string;

  @ApiPropertyOptional({
    description: "Email del dueño del lote (denormalizado)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  emailUsuario?: string;

  @ApiPropertyOptional({ description: "Descripción o nombre del lote" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({ description: 'ID del campo del lote (tabla "campo")' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  idCampo?: number;

  @ApiPropertyOptional({ description: "Geometría GeoJSON del lote (polígono)" })
  @IsOptional()
  @IsObject()
  geometria?: object;

  @ApiPropertyOptional({ description: "Centroide del lote: { lat, lng }" })
  @IsOptional()
  @IsObject()
  centroide?: object;

  @ApiPropertyOptional({ description: "Superficie del lote en ha" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  area?: number;

  @ApiPropertyOptional({
    description: "ID de la empresa destino (solo sys-admin)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  idEmpresa?: number;
}
