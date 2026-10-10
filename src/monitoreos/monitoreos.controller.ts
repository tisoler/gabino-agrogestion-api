import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { MonitoreosService } from "./monitoreos.service";
import { CreateMonitoreoDto } from "./dto/create-monitoreo.dto";
import { UpdateMonitoreoDto } from "./dto/update-monitoreo.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Roles as RolesConst } from "../constantes";

@ApiTags("monitoreos")
@Controller()
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class MonitoreosController {
  constructor(private readonly service: MonitoreosService) {}

  @Post("monitoreos")
  @UseGuards(RolesGuard)
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR)
  @Permissions("escritura:monitoreo-lote")
  @ApiOperation({ summary: "Registrar un monitoreo sobre una producción" })
  create(@Body() dto: CreateMonitoreoDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get("monitoreos")
  @Permissions("lectura:monitoreo-lote")
  @ApiOperation({ summary: "Listar monitoreos con filtros" })
  @ApiQuery({ name: "currentEmpresaId", required: false, type: Number })
  @ApiQuery({
    name: "empresaIds",
    required: false,
    description: "IDs de productores separados por coma",
  })
  @ApiQuery({
    name: "campanias",
    required: false,
    description: "Períodos separados por coma (ej: 25/26,26/27)",
  })
  @ApiQuery({
    name: "idCampo",
    required: false,
    description: "IDs de campos separados por coma (0 = sin campo)",
  })
  @ApiQuery({
    name: "idCultivo",
    required: false,
    description: "IDs de cultivos separados por coma",
  })
  @ApiQuery({
    name: "idVariedad",
    required: false,
    description: "IDs de variedades separados por coma",
  })
  @ApiQuery({
    name: "idLote",
    required: false,
    description: "IDs de lotes separados por coma",
  })
  @ApiQuery({ name: "idCampania", required: false, type: Number })
  findAll(
    @Request() req,
    @Query("currentEmpresaId") currentEmpresaId?: string,
    @Query("empresaIds") empresaIds?: string,
    @Query("campanias") campanias?: string,
    @Query("idCampo") idCampo?: string,
    @Query("idCultivo") idCultivo?: string,
    @Query("idVariedad") idVariedad?: string,
    @Query("idLote") idLote?: string,
    @Query("idCampania") idCampania?: string,
  ) {
    const parseIds = (s?: string): number[] | undefined =>
      s
        ? s
            .split(",")
            .map((n) => Number(n.trim()))
            .filter((n) => Number.isFinite(n))
        : undefined;
    return this.service.findAll(req.user, {
      currentEmpresaId: currentEmpresaId ? Number(currentEmpresaId) : undefined,
      empresaIds: empresaIds
        ? empresaIds
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n))
        : undefined,
      campanias: campanias
        ? campanias
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      idCampo: parseIds(idCampo),
      idCultivo: parseIds(idCultivo),
      idVariedad: parseIds(idVariedad),
      idLote: parseIds(idLote),
      idCampania: idCampania ? Number(idCampania) : undefined,
    });
  }

  @Get("monitoreos/:id")
  @Permissions("lectura:monitoreo-lote")
  @ApiOperation({ summary: "Ver un monitoreo" })
  findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Get("campanias/:idCampania/monitoreos")
  @Permissions("lectura:monitoreo-lote")
  @ApiOperation({ summary: "Listar monitoreos de una producción" })
  findByCampania(
    @Param("idCampania", ParseIntPipe) idCampania: number,
    @Request() req,
  ) {
    return this.service.findByCampania(idCampania, req.user);
  }

  @Patch("monitoreos/:id")
  @UseGuards(RolesGuard)
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR)
  @Permissions("escritura:monitoreo-lote")
  @ApiOperation({ summary: "Editar un monitoreo" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMonitoreoDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete("monitoreos/:id")
  @UseGuards(RolesGuard)
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR)
  @Permissions("escritura:monitoreo-lote")
  @ApiOperation({ summary: "Eliminar un monitoreo (borrado lógico)" })
  remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user);
  }
}
