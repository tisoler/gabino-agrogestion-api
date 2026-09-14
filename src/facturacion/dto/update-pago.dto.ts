import { IsIn, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdatePagoDto {
  @ApiProperty({ enum: ["pendiente", "pagado"] })
  @IsIn(["pendiente", "pagado"])
  @IsNotEmpty()
  estado: "pendiente" | "pagado";
}
