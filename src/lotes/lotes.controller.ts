import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LotesService } from './lotes.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('lotes')
@Controller('lotes')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Post()
  @Permissions('escritura:lote')
  @ApiOperation({ summary: 'Crear un nuevo lote' })
  create(@Body() createLoteDto: CreateLoteDto, @Request() req) {
    return this.lotesService.create(createLoteDto, req.user, req.user.currentEmpresaId);
  }

  @Get()
  @Permissions('lectura:lote')
  @ApiOperation({ summary: 'Listar lotes visibles' })
  @ApiQuery({ name: 'currentEmpresaId', required: false, type: Number, description: 'Filtrar por empresa' })
  findAll(
    @Request() req,
    @Query('currentEmpresaId') currentEmpresaId?: number,
  ) {
    return this.lotesService.findAll(req.user, currentEmpresaId);
  }

  @Get(':id')
  @Permissions('lectura:lote')
  @ApiOperation({ summary: 'Obtener un lote por id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lotesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('escritura:lote')
  @ApiOperation({ summary: 'Actualizar un lote' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLoteDto: UpdateLoteDto,
    @Request() req,
  ) {
    return this.lotesService.update(id, updateLoteDto, req.user);
  }
}
