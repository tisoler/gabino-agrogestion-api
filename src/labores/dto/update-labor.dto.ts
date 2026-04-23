import { PartialType } from '@nestjs/swagger';
import { CreateLaborDto } from './create-labor.dto';

export class UpdateLaborDto extends PartialType(CreateLaborDto) {}
