import { IsString, IsOptional, IsInt, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInsumoDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ required: false, description: 'Precio unitario de referencia' })
  @IsNumber()
  @IsOptional()
  precioUnitario?: number;

  @ApiProperty()
  @IsInt()
  idCategoria: number;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  idEmpresa?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  activo?: boolean;
}
