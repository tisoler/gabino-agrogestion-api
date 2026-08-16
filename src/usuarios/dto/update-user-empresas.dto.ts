import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsInt, IsOptional, Min, ArrayUnique } from "class-validator";

export class UpdateUserEmpresasDto {
  @ApiPropertyOptional({
    type: [Number],
    description:
      "IDs de empresas a asociar al usuario (se agregan al idEmpresas)",
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayUnique()
  add?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description:
      "IDs de empresas a desasociar del usuario (se quitan del idEmpresas)",
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayUnique()
  remove?: number[];
}
