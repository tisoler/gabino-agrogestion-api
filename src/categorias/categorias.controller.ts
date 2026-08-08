import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaInsumoDto } from './dto/create-categoria-insumo.dto';
import { UpdateCategoriaInsumoDto } from './dto/update-categoria-insumo.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('categorias')
@Controller('categorias')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) { }

  @Post()
  @Permissions('escritura:insumo')
  @ApiOperation({ summary: 'Crear una nueva categoría de insumo' })
  create(@Body() createCategoriaInsumoDto: CreateCategoriaInsumoDto, @Request() req) {
    return this.categoriasService.create(createCategoriaInsumoDto, req.user);
  }

  @Get()
  @Permissions('lectura:insumo')
  @ApiOperation({ summary: 'Listar todas las categorías de insumo' })
  findAll() {
    return this.categoriasService.findAll();
  }

  @Get(':id')
  @Permissions('lectura:insumo')
  @ApiOperation({ summary: 'Obtener una categoría de insumo por id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.findOne(id);
  }

  @Patch(':id')
  @Permissions('escritura:insumo')
  @ApiOperation({ summary: 'Actualizar una categoría de insumo' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoriaInsumoDto: UpdateCategoriaInsumoDto,
    @Request() req
  ) {
    return this.categoriasService.update(id, updateCategoriaInsumoDto, req.user);
  }
}
