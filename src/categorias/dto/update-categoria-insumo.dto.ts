import { PartialType } from "@nestjs/swagger";
import { CreateCategoriaInsumoDto } from "./create-categoria-insumo.dto";
import { IsOptional, IsBoolean } from "class-validator";

export class UpdateCategoriaInsumoDto extends PartialType(
  CreateCategoriaInsumoDto,
) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
