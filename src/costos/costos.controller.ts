import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CostosService } from './costos.service';
import { CreateCostoDto } from './dto/create-costo.dto';
import { UpdateCostoDto } from './dto/update-costo.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('costos')
@Controller('costos')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class CostosController {
  constructor(private readonly costosService: CostosService) { }

  @Post()
  @Permissions('escritura:costo')
  @ApiOperation({ summary: 'Crear un nuevo costo' })
  create(@Body() createCostoDto: CreateCostoDto, @Request() req) {
    return this.costosService.create(createCostoDto, req.user);
  }

  @Get()
  @Permissions('lectura:costo')
  @ApiOperation({ summary: 'Listar todos los costos' })
  @ApiQuery({ name: 'all', required: false, type: Boolean })
  @ApiQuery({ name: 'companyIds', required: false, type: String, description: 'IDs de empresas separados por coma' })
  @ApiQuery({ name: 'currentEmpresaId', required: false, type: Number, description: 'ID de la empresa actual' })
  findAll(
    @Request() req,
    @Query('all') all?: string,
    @Query('companyIds') companyIds?: string,
    @Query('currentEmpresaId') currentEmpresaId?: number
  ) {
    const showAll = all === 'true';
    return this.costosService.findAll(req.user, showAll, companyIds, currentEmpresaId);
  }

  @Get(':id')
  @Permissions('lectura:costo')
  @ApiOperation({ summary: 'Obtener un costo por id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.costosService.findOne(id);
  }

  @Patch(':id')
  @Permissions('escritura:costo')
  @ApiOperation({ summary: 'Actualizar un costo' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCostoDto: UpdateCostoDto,
    @Request() req
  ) {
    return this.costosService.update(id, updateCostoDto, req.user);
  }
}
