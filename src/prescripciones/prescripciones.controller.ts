import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PrescripcionesService } from './prescripciones.service';
import { CreatePrescripcionDto } from './dto/create-prescripcion.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('prescripciones')
@Controller('prescripciones')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class PrescripcionesController {
  constructor(private readonly service: PrescripcionesService) {}

  @Post()
  @Permissions('escritura:prescripcion')
  @ApiOperation({ summary: 'Crear una prescripción (asigna labor e insumos a la campaña)' })
  create(@Body() dto: CreatePrescripcionDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('lectura:prescripcion')
  @ApiOperation({ summary: 'Listar prescripciones con filtros' })
  @ApiQuery({ name: 'empresaId', required: false, type: Number })
  @ApiQuery({ name: 'idCampania', required: false, type: Number })
  @ApiQuery({ name: 'idLote', required: false, type: Number })
  @ApiQuery({ name: 'idLabor', required: false, type: Number })
  @ApiQuery({ name: 'idInsumo', required: false, type: Number })
  findAll(
    @Query('empresaId') empresaId?: string,
    @Query('idCampania') idCampania?: string,
    @Query('idLote') idLote?: string,
    @Query('idLabor') idLabor?: string,
    @Query('idInsumo') idInsumo?: string,
  ) {
    return this.service.findAll({
      empresaId: empresaId ? Number(empresaId) : undefined,
      idCampania: idCampania ? Number(idCampania) : undefined,
      idLote: idLote ? Number(idLote) : undefined,
      idLabor: idLabor ? Number(idLabor) : undefined,
      idInsumo: idInsumo ? Number(idInsumo) : undefined,
    });
  }

  @Get(':id')
  @Permissions('lectura:prescripcion')
  @ApiOperation({ summary: 'Obtener una prescripción con sus insumos' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
