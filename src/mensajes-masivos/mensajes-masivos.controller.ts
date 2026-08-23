import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { MensajesMasivosService } from "./mensajes-masivos.service";
import { CreateMensajeMasivoDto } from "./dto/create-mensaje-masivo.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { Roles as RolesConst } from "../constantes";

@ApiTags("mensajes-masivos")
@Controller("mensajes-masivos")
@UseGuards(FirebaseGuard, PermissionsGuard, RolesGuard)
@ApiBearerAuth()
export class MensajesMasivosController {
  constructor(private readonly service: MensajesMasivosService) {}

  @Get()
  @Permissions("lectura:mensaje-masivo")
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR_ADMIN, RolesConst.ASESOR)
  @ApiOperation({
    summary: "Listar el historial de mensajes masivos",
    description:
      "Devuelve los registros (más reciente primero) con el cultivo " +
      "asociado. Sys-admin y asesor-admin ven todo; el asesor sólo sus " +
      "propios envíos. El filtrado y la cascada se hacen en el FE.",
  })
  findAll(@Request() req) {
    return this.service.findAll(req.user);
  }

  @Get("destinatarios")
  @Permissions("lectura:mensaje-masivo")
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR_ADMIN, RolesConst.ASESOR)
  @ApiOperation({
    summary: "Destinatarios para un cultivo en un período",
    description:
      "Usuarios (productor o asesor) con celular, vinculados a empresas con " +
      "producción del cultivo indicado en el período. Admins ven todas las " +
      "empresas; el resto sólo las de su idEmpresas.",
  })
  @ApiQuery({ name: "idCultivo", required: true, type: Number })
  @ApiQuery({
    name: "campania",
    required: false,
    description: "Período (ej: 26/27). Default: período actual.",
  })
  destinatarios(
    @Request() req,
    @Query("idCultivo", ParseIntPipe) idCultivo: number,
    @Query("campania") campania?: string,
  ) {
    return this.service.destinatarios(idCultivo, req.user, campania);
  }

  @Get(":id")
  @Permissions("lectura:mensaje-masivo")
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR_ADMIN, RolesConst.ASESOR)
  @ApiOperation({ summary: "Detalle de un mensaje masivo" })
  findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Post()
  @Permissions("escritura:mensaje-masivo")
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR_ADMIN, RolesConst.ASESOR)
  @ApiOperation({
    summary: "Registrar un envío de mensaje masivo",
    description:
      "Re-resuelve los destinatarios en el servidor (ignora uids inválidos), " +
      "guarda el historial y devuelve el registro junto a los destinatarios " +
      "resueltos para que el FE abra los chats de WhatsApp.",
  })
  create(@Body() dto: CreateMensajeMasivoDto, @Request() req) {
    return this.service.create(dto, req.user);
  }
}
