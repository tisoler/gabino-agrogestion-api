import {
  BadRequestException,
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
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { CampaniasService } from "./campanias.service";
import { buildCampaniaXls } from "./campanias.export";
import {
  buildSegurosCsv,
  buildSegurosRows,
  buildSegurosXls,
  nombreArchivoSeguros,
} from "./campanias.seguros";
import { CreateCampaniaDto } from "./dto/create-campania.dto";
import { UpdateCampaniaDto } from "./dto/update-campania.dto";
import {
  CompartirSegurosDto,
  DescargarSegurosDto,
  GuardarSegurosDto,
} from "./dto/seguros.dto";
import { SpacesService } from "../spaces/spaces.service";
import { CotizacionesService } from "../cotizaciones/cotizaciones.service";
import {
  CreateCampaniaDetalleCostoDto,
  CreateCampaniaDetalleInsumoDto,
  CreateCampaniaDetalleLaborDto,
} from "./dto/create-detalle.dto";
import {
  UpdateCampaniaDetalleCostoDto,
  UpdateCampaniaDetalleInsumoDto,
  UpdateCampaniaDetalleLaborDto,
} from "./dto/update-detalle.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("campanias")
@Controller("campanias")
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class CampaniasController {
  constructor(
    private readonly service: CampaniasService,
    private readonly spaces: SpacesService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Cabecera
  // ---------------------------------------------------------------------------
  @Post()
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Crear una nueva campaña" })
  create(@Body() dto: CreateCampaniaDto, @Request() req) {
    return this.service.create(dto, req.user, req.user.currentEmpresaId);
  }

  @Get()
  @Permissions("lectura:campania")
  @ApiOperation({ summary: "Listar campañas con filtros" })
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
  findAll(
    @Request() req,
    @Query("currentEmpresaId") currentEmpresaId?: string,
    @Query("empresaIds") empresaIds?: string,
    @Query("campanias") campanias?: string,
    @Query("idCampo") idCampo?: string,
    @Query("idCultivo") idCultivo?: string,
    @Query("idVariedad") idVariedad?: string,
    @Query("idLote") idLote?: string,
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
    });
  }

  // ---------------------------------------------------------------------------
  // Seguros: planilla de granizo (rutas estáticas antes de `:id`)
  // ---------------------------------------------------------------------------
  @Get("seguros/planilla")
  @Permissions("lectura:campania")
  @ApiOperation({
    summary: "Filas para la planilla de seguros de las producciones indicadas",
  })
  @ApiQuery({
    name: "ids",
    required: true,
    description: "IDs separados por coma",
  })
  async segurosPlanilla(@Request() req, @Query("ids") ids?: string) {
    const list = (ids ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    return this.service.getSegurosPlanilla(list, req.user);
  }

  @Post("seguros/guardar")
  @Permissions("escritura:campania")
  @ApiOperation({
    summary:
      "Guarda datos de seguros en las producciones (aseguradora, qq, fechas de siembra) sin generar archivo",
  })
  async segurosGuardar(@Body() dto: GuardarSegurosDto, @Request() req) {
    const { campanias } = await this.service.guardarSegurosDatos(dto, req.user);
    return campanias;
  }

  @Post("seguros/descargar")
  @Permissions("escritura:campania")
  @ApiOperation({
    summary:
      "Guarda aseguradora + qq en las producciones y devuelve la planilla (csv/xls)",
  })
  async segurosDescargar(
    @Body() dto: DescargarSegurosDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const formato = dto.formato ?? "xls";
    const { campanias, aseguradora } = await this.service.guardarSegurosDatos(
      dto,
      req.user,
    );
    if (!aseguradora) {
      throw new BadRequestException(
        "La empresa de seguros es obligatoria para descargar la planilla",
      );
    }
    const rows = buildSegurosRows(
      campanias.map((c) => ({
        campania: c,
        qq: c.qqAsegurados != null ? Number(c.qqAsegurados) : null,
      })),
    );
    const buffer =
      formato === "csv" ? buildSegurosCsv(rows) : buildSegurosXls(rows);
    const nombre = nombreArchivoSeguros(aseguradora.nombre, formato);
    res.setHeader(
      "Content-Type",
      formato === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.ms-excel",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  }

  @Post("seguros/compartir")
  @Permissions("escritura:campania")
  @ApiOperation({
    summary:
      "Guarda aseguradora + qq en las producciones, sube la planilla y devuelve su URL para WhatsApp",
  })
  async segurosCompartir(@Body() dto: CompartirSegurosDto, @Request() req) {
    const { campanias } = await this.service.guardarSegurosDatos(dto, req.user);
    const rows = buildSegurosRows(
      campanias.map((c) => ({
        campania: c,
        qq: c.qqAsegurados != null ? Number(c.qqAsegurados) : null,
      })),
    );
    const buffer = buildSegurosXls(rows);
    const key = this.spaces.generarKeySeguros("xls");
    const url = await this.spaces.subirArchivo(
      key,
      buffer,
      "application/vnd.ms-excel",
    );
    return { url };
  }

  @Get(":id")
  @Permissions("lectura:campania")
  @ApiOperation({ summary: "Obtener una campaña con todos sus detalles" })
  findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Get(":id/export")
  @Permissions("lectura:campania")
  @ApiOperation({ summary: "Exportar la campaña a archivo .xls" })
  async exportXls(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
    @Res() res: Response,
  ) {
    const campania = await this.service.findOne(id, req.user);
    // Los costos de insumos se guardan en USD: se convierten a pesos con el
    // dólar venta, igual que en el detalle (si falla, 1 = sin conversión).
    let dolarInsumo = 1;
    try {
      const { venta } = await this.cotizaciones.getDolarBNA();
      if (Number.isFinite(venta) && venta > 0) dolarInsumo = venta;
    } catch {
      dolarInsumo = 1;
    }
    const buffer = buildCampaniaXls(campania, dolarInsumo);

    const nombreArchivo =
      (campania?.lote?.descripcion || `campania-${id}`)
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() + ".xls";

    res.setHeader("Content-Type", "application/vnd.ms-excel");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="export-${nombreArchivo}"`,
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  }

  @Patch(":id")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Actualizar la cabecera de una campaña" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCampaniaDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Eliminar (soft) una campaña" })
  remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user);
  }

  // ---------------------------------------------------------------------------
  // Detalles: LABORES
  // ---------------------------------------------------------------------------
  @Post(":id/labores")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Agregar una labor a la campaña" })
  addLabor(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateCampaniaDetalleLaborDto,
    @Request() req,
  ) {
    return this.service.addLabor(id, dto, req.user);
  }

  @Patch(":id/labores/:detalleId")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Actualizar una labor de la campaña" })
  updateLabor(
    @Param("id", ParseIntPipe) id: number,
    @Param("detalleId", ParseIntPipe) detalleId: number,
    @Body() dto: UpdateCampaniaDetalleLaborDto,
    @Request() req,
  ) {
    return this.service.updateLabor(id, detalleId, dto, req.user);
  }

  @Delete(":id/labores/:detalleId")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Eliminar una labor de la campaña" })
  removeLabor(
    @Param("id", ParseIntPipe) id: number,
    @Param("detalleId", ParseIntPipe) detalleId: number,
    @Request() req,
  ) {
    return this.service.removeLabor(id, detalleId, req.user);
  }

  // ---------------------------------------------------------------------------
  // Detalles: INSUMOS
  // ---------------------------------------------------------------------------
  @Post(":id/insumos")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Agregar un insumo a la campaña" })
  addInsumo(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateCampaniaDetalleInsumoDto,
    @Request() req,
  ) {
    return this.service.addInsumo(id, dto, req.user);
  }

  @Patch(":id/insumos/:detalleId")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Actualizar un insumo de la campaña" })
  updateInsumo(
    @Param("id", ParseIntPipe) id: number,
    @Param("detalleId", ParseIntPipe) detalleId: number,
    @Body() dto: UpdateCampaniaDetalleInsumoDto,
    @Request() req,
  ) {
    return this.service.updateInsumo(id, detalleId, dto, req.user);
  }

  @Delete(":id/insumos/:detalleId")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Eliminar un insumo de la campaña" })
  removeInsumo(
    @Param("id", ParseIntPipe) id: number,
    @Param("detalleId", ParseIntPipe) detalleId: number,
    @Request() req,
  ) {
    return this.service.removeInsumo(id, detalleId, req.user);
  }

  // ---------------------------------------------------------------------------
  // Detalles: COSTOS VARIOS
  // ---------------------------------------------------------------------------
  @Post(":id/costos")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Agregar un costo vario a la campaña" })
  addCosto(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateCampaniaDetalleCostoDto,
    @Request() req,
  ) {
    return this.service.addCosto(id, dto, req.user);
  }

  @Patch(":id/costos/:detalleId")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Actualizar un costo vario de la campaña" })
  updateCosto(
    @Param("id", ParseIntPipe) id: number,
    @Param("detalleId", ParseIntPipe) detalleId: number,
    @Body() dto: UpdateCampaniaDetalleCostoDto,
    @Request() req,
  ) {
    return this.service.updateCosto(id, detalleId, dto, req.user);
  }

  @Delete(":id/costos/:detalleId")
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Eliminar un costo vario de la campaña" })
  removeCosto(
    @Param("id", ParseIntPipe) id: number,
    @Param("detalleId", ParseIntPipe) detalleId: number,
    @Request() req,
  ) {
    return this.service.removeCosto(id, detalleId, req.user);
  }
}
