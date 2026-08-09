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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CampaniasService } from './campanias.service';
import { buildCampaniaXls } from './campanias.export';
import { CreateCampaniaDto } from './dto/create-campania.dto';
import { UpdateCampaniaDto } from './dto/update-campania.dto';
import {
  CreateCampaniaDetalleCostoDto,
  CreateCampaniaDetalleInsumoDto,
  CreateCampaniaDetalleLaborDto,
} from './dto/create-detalle.dto';
import {
  UpdateCampaniaDetalleCostoDto,
  UpdateCampaniaDetalleInsumoDto,
  UpdateCampaniaDetalleLaborDto,
} from './dto/update-detalle.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('campanias')
@Controller('campanias')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class CampaniasController {
  constructor(private readonly service: CampaniasService) {}

  // ---------------------------------------------------------------------------
  // Cabecera
  // ---------------------------------------------------------------------------
  @Post()
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Crear una nueva campaña' })
  create(@Body() dto: CreateCampaniaDto, @Request() req) {
    return this.service.create(dto, req.user, req.user.currentEmpresaId);
  }

  @Get()
  @Permissions('lectura:campania')
  @ApiOperation({ summary: 'Listar campañas con filtros' })
  @ApiQuery({ name: 'currentEmpresaId', required: false, type: Number })
  @ApiQuery({ name: 'campanias', required: false, description: 'Períodos separados por coma (ej: 25/26,26/27)' })
  @ApiQuery({ name: 'nombre', required: false, type: String })
  @ApiQuery({ name: 'idCultivo', required: false, type: Number })
  @ApiQuery({ name: 'idVariedad', required: false, type: Number })
  @ApiQuery({ name: 'idLote', required: false, type: Number })
  findAll(
    @Request() req,
    @Query('currentEmpresaId') currentEmpresaId?: string,
    @Query('campanias') campanias?: string,
    @Query('nombre') nombre?: string,
    @Query('idCultivo') idCultivo?: string,
    @Query('idVariedad') idVariedad?: string,
    @Query('idLote') idLote?: string,
  ) {
    return this.service.findAll(req.user, {
      currentEmpresaId: currentEmpresaId ? Number(currentEmpresaId) : undefined,
      campanias: campanias ? campanias.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      nombre: nombre || undefined,
      idCultivo: idCultivo ? Number(idCultivo) : undefined,
      idVariedad: idVariedad ? Number(idVariedad) : undefined,
      idLote: idLote ? Number(idLote) : undefined,
    });
  }

  @Get(':id')
  @Permissions('lectura:campania')
  @ApiOperation({ summary: 'Obtener una campaña con todos sus detalles' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Get(':id/export')
  @Permissions('lectura:campania')
  @ApiOperation({ summary: 'Exportar la campaña a archivo .xls' })
  async exportXls(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Res() res: Response,
  ) {
    const campania = await this.service.findOne(id, req.user);
    const buffer = buildCampaniaXls(campania);

    const nombreArchivo =
      (campania?.lote?.descripcion || campania?.nombre || `campania-${id}`)
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() + '.xls';

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export-${nombreArchivo}"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Patch(':id')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Actualizar la cabecera de una campaña' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampaniaDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Eliminar (soft) una campaña' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user);
  }

  // ---------------------------------------------------------------------------
  // Detalles: LABORES
  // ---------------------------------------------------------------------------
  @Post(':id/labores')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Agregar una labor a la campaña' })
  addLabor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCampaniaDetalleLaborDto,
    @Request() req,
  ) {
    return this.service.addLabor(id, dto, req.user);
  }

  @Patch(':id/labores/:detalleId')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Actualizar una labor de la campaña' })
  updateLabor(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Body() dto: UpdateCampaniaDetalleLaborDto,
    @Request() req,
  ) {
    return this.service.updateLabor(id, detalleId, dto, req.user);
  }

  @Delete(':id/labores/:detalleId')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Eliminar una labor de la campaña' })
  removeLabor(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Request() req,
  ) {
    return this.service.removeLabor(id, detalleId, req.user);
  }

  // ---------------------------------------------------------------------------
  // Detalles: INSUMOS
  // ---------------------------------------------------------------------------
  @Post(':id/insumos')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Agregar un insumo a la campaña' })
  addInsumo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCampaniaDetalleInsumoDto,
    @Request() req,
  ) {
    return this.service.addInsumo(id, dto, req.user);
  }

  @Patch(':id/insumos/:detalleId')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Actualizar un insumo de la campaña' })
  updateInsumo(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Body() dto: UpdateCampaniaDetalleInsumoDto,
    @Request() req,
  ) {
    return this.service.updateInsumo(id, detalleId, dto, req.user);
  }

  @Delete(':id/insumos/:detalleId')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Eliminar un insumo de la campaña' })
  removeInsumo(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Request() req,
  ) {
    return this.service.removeInsumo(id, detalleId, req.user);
  }

  // ---------------------------------------------------------------------------
  // Detalles: COSTOS VARIOS
  // ---------------------------------------------------------------------------
  @Post(':id/costos')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Agregar un costo vario a la campaña' })
  addCosto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCampaniaDetalleCostoDto,
    @Request() req,
  ) {
    return this.service.addCosto(id, dto, req.user);
  }

  @Patch(':id/costos/:detalleId')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Actualizar un costo vario de la campaña' })
  updateCosto(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Body() dto: UpdateCampaniaDetalleCostoDto,
    @Request() req,
  ) {
    return this.service.updateCosto(id, detalleId, dto, req.user);
  }

  @Delete(':id/costos/:detalleId')
  @Permissions('escritura:campania')
  @ApiOperation({ summary: 'Eliminar un costo vario de la campaña' })
  removeCosto(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Request() req,
  ) {
    return this.service.removeCosto(id, detalleId, req.user);
  }
}
