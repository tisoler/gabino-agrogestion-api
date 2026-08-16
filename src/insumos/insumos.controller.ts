import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { InsumosService } from "./insumos.service";
import { CreateInsumoDto } from "./dto/create-insumo.dto";
import { UpdateInsumoDto } from "./dto/update-insumo.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("insumos")
@Controller("insumos")
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class InsumosController {
  constructor(private readonly insumosService: InsumosService) {}

  @Post()
  @Permissions("escritura:insumo")
  @ApiOperation({ summary: "Crear un nuevo insumo" })
  create(@Body() createInsumoDto: CreateInsumoDto, @Request() req) {
    return this.insumosService.create(
      createInsumoDto,
      req.user,
      req.user.currentEmpresaId,
    );
  }

  @Get()
  @Permissions("lectura:insumo")
  @ApiOperation({ summary: "Listar todos los insumos" })
  @ApiQuery({ name: "all", required: false, type: Boolean })
  @ApiQuery({
    name: "companyIds",
    required: false,
    type: String,
    description: "IDs de empresas separados por coma",
  })
  @ApiQuery({
    name: "currentEmpresaId",
    required: false,
    type: Number,
    description: "ID de la empresa actual",
  })
  @ApiQuery({
    name: "soloActivos",
    required: false,
    type: Boolean,
    description: "Si es true, filtra solo ítems activos",
  })
  @ApiQuery({
    name: "scope",
    required: false,
    type: String,
    description: "global | empresa (para no-admin)",
  })
  findAll(
    @Request() req,
    @Query("all") all?: string,
    @Query("companyIds") companyIds?: string,
    @Query("currentEmpresaId") currentEmpresaId?: number,
    @Query("soloActivos") soloActivos?: string,
    @Query("scope") scope?: string,
  ) {
    const showAll = all === "true";
    const onlyActive = soloActivos === "true";
    return this.insumosService.findAll(
      req.user,
      showAll,
      companyIds,
      currentEmpresaId,
      onlyActive,
      scope,
    );
  }

  @Get(":id")
  @Permissions("lectura:insumo")
  @ApiOperation({ summary: "Obtener un insumo por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.insumosService.findOne(id);
  }

  @Patch(":id")
  @Permissions("escritura:insumo")
  @ApiOperation({ summary: "Actualizar un insumo" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateInsumoDto: UpdateInsumoDto,
    @Request() req,
  ) {
    return this.insumosService.update(id, updateInsumoDto, req.user);
  }
}
