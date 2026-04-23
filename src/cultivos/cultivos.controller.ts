import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CultivosService } from './cultivos.service';
import { CreateCultivoDto } from './dto/create-cultivo.dto';
import { UpdateCultivoDto } from './dto/update-cultivo.dto';
import { CreateVariedadDto } from './dto/create-variedad.dto';
import { UpdateVariedadDto } from './dto/update-variedad.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('cultivos')
@Controller('cultivos')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class CultivosController {
  constructor(private readonly cultivosService: CultivosService) { }

  @Post()
  @Permissions('escritura:cultivo')
  @ApiOperation({ summary: 'Crear un nuevo cultivo' })
  create(@Body() createCultivoDto: CreateCultivoDto, @Request() req) {
    return this.cultivosService.create(createCultivoDto, req.user);
  }

  @Get()
  @Permissions('lectura:cultivo')
  @ApiOperation({ summary: 'Listar todos los cultivos' })
  @ApiQuery({ name: 'all', required: false, type: Boolean })
  @ApiQuery({ name: 'companyIds', required: false, type: String })
  @ApiQuery({ name: 'currentEmpresaId', required: false, type: Number })
  findAll(
    @Request() req,
    @Query('all') all?: string,
    @Query('companyIds') companyIds?: string,
    @Query('currentEmpresaId') currentEmpresaId?: number
  ) {
    const showAll = all === 'true';
    return this.cultivosService.findAll(req.user, showAll, companyIds, currentEmpresaId);
  }

  @Get(':id')
  @Permissions('lectura:cultivo')
  @ApiOperation({ summary: 'Obtener un cultivo por id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cultivosService.findOne(id);
  }

  @Patch(':id')
  @Permissions('escritura:cultivo')
  @ApiOperation({ summary: 'Actualizar un cultivo' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCultivoDto: UpdateCultivoDto,
    @Request() req
  ) {
    return this.cultivosService.update(id, updateCultivoDto, req.user);
  }

  // Variedades
  @Post('variedades')
  @Permissions('escritura:cultivo')
  @ApiOperation({ summary: 'Crear una nueva variedad' })
  createVariedad(@Body() createVariedadDto: CreateVariedadDto, @Request() req) {
    return this.cultivosService.createVariedad(createVariedadDto, req.user);
  }

  @Patch('variedades/:id')
  @Permissions('escritura:cultivo')
  @ApiOperation({ summary: 'Actualizar una variedad' })
  updateVariedad(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVariedadDto: UpdateVariedadDto,
    @Request() req
  ) {
    return this.cultivosService.updateVariedad(id, updateVariedadDto, req.user);
  }
}
