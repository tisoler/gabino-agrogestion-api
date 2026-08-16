import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import {
  EmpresasService,
  EmpresaConUsuarios,
  UsuarioBasico,
} from "./empresas.service";
import { CreateEmpresaDto } from "./dto/create-empresa.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { Roles as RolesConst } from "../constantes";

@ApiTags("empresas")
@Controller("empresas")
@UseGuards(FirebaseGuard, PermissionsGuard, RolesGuard)
@ApiBearerAuth()
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get()
  @Permissions("lectura:empresa")
  @ApiOperation({ summary: "Listar empresas permitidas para el usuario" })
  findAll(@Request() req) {
    return this.empresasService.findAll(req.user);
  }

  @Get("with-users")
  @Permissions("lectura:productor")
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR, RolesConst.ASESOR_ADMIN)
  @ApiOperation({
    summary: "Listar empresas con sus usuarios (asesores y productores)",
    description:
      "Devuelve las empresas visibles para el usuario y, para cada una, los usuarios de Firestore (asesores y productores) vinculados.",
  })
  findAllWithUsers(@Request() req): Promise<EmpresaConUsuarios[]> {
    return this.empresasService.findAllWithUsers(req.user);
  }

  @Get(":id/usuarios")
  @Permissions("lectura:lote")
  @ApiOperation({
    summary: "Listar usuarios (asesores y productores) de una empresa",
    description:
      'Pensado para alimentar pickers de "dueño" en flujos como el alta de lotes. sys-admin puede pedir cualquier empresa; el resto sólo sus idEmpresas.',
  })
  @ApiParam({ name: "id", type: Number, description: "ID de la empresa" })
  findUsuariosByEmpresa(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ): Promise<UsuarioBasico[]> {
    return this.empresasService.findUsuariosByEmpresa(id, req.user);
  }

  @Post()
  @Permissions("escritura:empresa")
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR, RolesConst.ASESOR_ADMIN)
  @ApiOperation({ summary: "Crear una nueva empresa" })
  create(@Body() createEmpresaDto: CreateEmpresaDto, @Request() req) {
    return this.empresasService.create(createEmpresaDto, req.user);
  }
}
