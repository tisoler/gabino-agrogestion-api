import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { FirebaseBootstrapGuard } from '../auth/guards/firebase-bootstrap.guard';

/**
 * Controller separado de UsuariosController para el bootstrap: no lleva los
 * guards de clase (FirebaseGuard + PermissionsGuard + RolesGuard) porque el
 * documento del usuario recién se va a crear y FirebaseGuard lo rechazaría.
 */
@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosBootstrapController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post('bootstrap')
  @UseGuards(FirebaseBootstrapGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crea el documento del usuario en Firestore si no existe (signup)',
  })
  bootstrap(@Request() req) {
    return this.usuariosService.bootstrapUsuario(req.user);
  }
}
