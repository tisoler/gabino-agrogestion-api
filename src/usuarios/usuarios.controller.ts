import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
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

  @Get('candidatos')
  @Permissions('escritura:empresa')
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR, RolesConst.ASESOR_ADMIN)
  @ApiOperation({
    summary: 'Listar usuarios candidatos para asociar a empresas',
    description:
      'Devuelve todos los usuarios de Firestore con cualquier rol excepto sys-admin, ' +
      'sin importar si tienen empresas asignadas. Alimenta los pickers de "agregar usuario" ' +
      'tanto en la edición de empresas como en el alta de una nueva. El FE excluye al usuario ' +
      'en sesión y a los ya vinculados a la empresa.',
  })
  findCandidatos(): Promise<UsuarioBasico[]> {
    return this.usuariosService.findCandidatos();
  }

  @Patch(':uid/empresas')
  @Permissions('escritura:empresa')
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR, RolesConst.ASESOR_ADMIN)
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
