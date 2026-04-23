import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmpresasService } from './empresas.service';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('empresas')
@Controller('empresas')
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get()
  @Permissions('lectura:empresa')
  @ApiOperation({ summary: 'Listar empresas permitidas' })
  findAll(@Request() req) {
    return this.empresasService.findAll(req.user);
  }
}
