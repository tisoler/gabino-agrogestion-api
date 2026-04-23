import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LaboresService } from './labores.service';
import { CreateLaborDto } from './dto/create-labor.dto';
import { UpdateLaborDto } from './dto/update-labor.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('labores')
@Controller('labores')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class LaboresController {
  constructor(private readonly laboresService: LaboresService) { }

  @Post()
  @Permissions('escritura:labor')
  @ApiOperation({ summary: 'Crear una nueva labor' })
  create(@Body() createLaborDto: CreateLaborDto, @Request() req) {
    return this.laboresService.create(createLaborDto, req.user);
  }

  @Get()
  @Permissions('lectura:labor')
  @ApiOperation({ summary: 'Listar todas las labores' })
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
    return this.laboresService.findAll(req.user, showAll, companyIds, currentEmpresaId);
  }

  @Get(':id')
  @Permissions('lectura:labor')
  @ApiOperation({ summary: 'Obtener una labor por id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.laboresService.findOne(id);
  }

  @Patch(':id')
  @Permissions('escritura:labor')
  @ApiOperation({ summary: 'Actualizar una labor' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLaborDto: UpdateLaborDto,
    @Request() req
  ) {
    return this.laboresService.update(id, updateLaborDto, req.user);
  }
}
