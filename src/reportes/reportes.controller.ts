import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('reportes')
@Controller('reportes')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Post()
  @Permissions('escritura:reporte')
  @ApiOperation({ summary: 'Crear un reporte (Resumen Campaña o Detalle asesoramiento)' })
  create(@Body() dto: CreateReporteDto, @Request() req) {
    return this.service.create(req.user, dto);
  }

  @Get('producciones')
  @Permissions('lectura:reporte')
  @ApiOperation({
    summary:
      'Producciones candidatas (lotes y producciones con datos calculados) para armar un reporte',
  })
  @ApiQuery({ name: 'empresaId', required: true, type: Number })
  @ApiQuery({ name: 'campania', required: true, type: String })
  producciones(
    @Request() req,
    @Query('empresaId') empresaId?: string,
    @Query('campania') campania?: string,
  ) {
    return this.service.producciones(req.user, Number(empresaId), String(campania || ''));
  }

  @Get()
  @Permissions('lectura:reporte')
  @ApiOperation({ summary: 'Listar reportes visibles' })
  findAll(@Request() req) {
    return this.service.findAll(req.user);
  }

  @Get(':id')
  @Permissions('lectura:reporte')
  @ApiOperation({ summary: 'Obtener un reporte con sus valores calculados' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(req.user, id);
  }

  @Patch(':id')
  @Permissions('escritura:reporte')
  @ApiOperation({ summary: 'Actualizar un reporte (cabecera y filas)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReporteDto,
    @Request() req,
  ) {
    return this.service.update(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions('escritura:reporte')
  @ApiOperation({ summary: 'Eliminar (soft) un reporte' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(req.user, id);
  }
}
