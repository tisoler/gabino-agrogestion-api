import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductoresService } from './productores.service';
import { CreateProductorDto } from './dto/create-productor.dto';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('productores')
@Controller('productores')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class ProductoresController {
  constructor(private readonly productoresService: ProductoresService) {}

  @Post()
  @Permissions('escritura:productor')
  @ApiOperation({ summary: 'Crear un nuevo productor' })
  create(@Body() createProductorDto: CreateProductorDto, @Request() req) {
    return this.productoresService.create(createProductorDto, req.user.idEmpresa);
  }

  @Get()
  @Permissions('lectura:productor')
  @ApiOperation({ summary: 'Listar todos los productores' })
  findAll(@Request() req) {
    return this.productoresService.findAll(req.user.idEmpresa);
  }
}
