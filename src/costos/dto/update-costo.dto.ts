import { PartialType } from '@nestjs/swagger';
import { CreateCostoDto } from './create-costo.dto';

export class UpdateCostoDto extends PartialType(CreateCostoDto) {}
