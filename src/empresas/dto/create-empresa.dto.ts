import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEmpresaDto {
  @ApiProperty({ description: 'Nombre de la empresa' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  nombre: string;
}
