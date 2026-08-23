import {
  Body,
  Controller,
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
import { PrescripcionesService } from "./prescripciones.service";
import { CreatePrescripcionDto } from "./dto/create-prescripcion.dto";
import { UpdateAnuladaDto } from "./dto/update-anulada.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("prescripciones")
@Controller("prescripciones")
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class PrescripcionesController {
  constructor(private readonly service: PrescripcionesService) {}

  @Post()
  @Permissions("escritura:prescripcion")
  @ApiOperation({
    summary: "Crear una prescripción (asigna labor e insumos a la campaña)",
  })
  create(@Body() dto: CreatePrescripcionDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Permissions("lectura:prescripcion")
  @ApiOperation({ summary: "Listar prescripciones con filtros" })
  @ApiQuery({ name: "empresaId", required: false, type: Number })
  @ApiQuery({
    name: "empresaIds",
    required: false,
    description: "IDs de productores separados por coma",
  })
  @ApiQuery({ name: "idCampania", required: false, type: Number })
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
    name: "idLote",
    required: false,
    description: "IDs de lotes separados por coma",
  })
  @ApiQuery({
    name: "idLabor",
    required: false,
    description: "IDs de labores separados por coma",
  })
  @ApiQuery({
    name: "idInsumo",
    required: false,
    description: "IDs de insumos separados por coma",
  })
  findAll(
    @Request() req,
    @Query("empresaId") empresaId?: string,
    @Query("empresaIds") empresaIds?: string,
    @Query("idCampania") idCampania?: string,
    @Query("campanias") campanias?: string,
    @Query("idCampo") idCampo?: string,
    @Query("idLote") idLote?: string,
    @Query("idLabor") idLabor?: string,
    @Query("idInsumo") idInsumo?: string,
  ) {
    const parseIds = (s?: string): number[] | undefined =>
      s
        ? s
            .split(",")
            .map((n) => Number(n.trim()))
            .filter((n) => Number.isFinite(n))
        : undefined;
    return this.service.findAll(req.user, {
      empresaId: empresaId ? Number(empresaId) : undefined,
      empresaIds: empresaIds
        ? empresaIds
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n))
        : undefined,
      idCampania: idCampania ? Number(idCampania) : undefined,
      campanias: campanias
        ? campanias
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      idCampo: parseIds(idCampo),
      idLote: parseIds(idLote),
      idLabor: parseIds(idLabor),
      idInsumo: parseIds(idInsumo),
    });
  }

  @Get(":id")
  @Permissions("lectura:prescripcion")
  @ApiOperation({ summary: "Obtener una prescripción con sus insumos" })
  findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Patch(":id/anulada")
  @Permissions("escritura:prescripcion")
  @ApiOperation({
    summary: "Anular o recuperar una prescripción (borrado lógico)",
  })
  setAnulada(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAnuladaDto,
    @Request() req,
  ) {
    return this.service.setAnulada(id, dto.anulada, req.user);
  }
}
