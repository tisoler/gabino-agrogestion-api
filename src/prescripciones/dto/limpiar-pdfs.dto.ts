import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class LimpiarPdfsDto {
  @ApiProperty({
    description:
      "Antigüedad mínima (en meses) de los PDFs a eliminar. Ej: 3 elimina los generados hace 3 meses o más.",
    example: 3,
  })
  @IsInt()
  @Min(1)
  meses: number;
}
