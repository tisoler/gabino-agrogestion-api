import { IsDateString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class BalanceQueryDto {
  @ApiProperty({ required: false, example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false, example: "2026-12-31" })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
