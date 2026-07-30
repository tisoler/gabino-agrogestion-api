import { Controller, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { UpdateUserEmpresasDto } from './dto/update-user-empresas.dto';
import type { UsuarioBasico } from '../empresas/empresas.service';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Roles as RolesConst } from '../constantes';

@ApiTags('usuarios')
@Controller('usuarios')
@UseGuards(FirebaseGuard, PermissionsGuard, RolesGuard)
@ApiBearerAuth()
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Patch(':uid/empresas')
  @Permissions('escritura:empresa')
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR)
  @ApiOperation({
    summary: 'Asociar / desasociar empresas a un usuario',
    description:
      'Actualiza el array `idEmpresas` del documento del usuario en Firestore. ' +
      '`add` agrega IDs, `remove` los quita. Idempotente. Sólo sys-admin y asesor; ' +
      'el asesor sólo puede tocar empresas de su propio `idEmpresas`.',
  })
  @ApiParam({ name: 'uid', description: 'UID de Firebase del usuario' })
  async updateEmpresas(
    @Param('uid') uid: string,
    @Body() dto: UpdateUserEmpresasDto,
    @Request() req,
  ): Promise<UsuarioBasico> {
    return this.usuariosService.updateEmpresas(
      uid,
      dto.add ?? [],
      dto.remove ?? [],
      req.user,
    );
  }
}
