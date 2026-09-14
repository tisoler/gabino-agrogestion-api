import { IsNumber, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateTarifaDto {
  @ApiProperty({ example: 30000 })
  @IsNumber()
  @Min(1)
  tarifaBase: number;
}
