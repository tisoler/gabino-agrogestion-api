import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateAnuladaDto {
  @ApiProperty({ description: 'true para anular la prescripción, false para recuperarla' })
  @IsBoolean()
  anulada: boolean;
}
