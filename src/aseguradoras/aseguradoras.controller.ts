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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AseguradorasService } from "./aseguradoras.service";
import { CreateAseguradoraDto } from "./dto/create-aseguradora.dto";
import { UpdateAseguradoraDto } from "./dto/update-aseguradora.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("aseguradoras")
@Controller("aseguradoras")
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class AseguradorasController {
  constructor(private readonly service: AseguradorasService) {}

  @Post()
  @Permissions("escritura:campania")
  @ApiOperation({ summary: "Crear una empresa de seguros (sys-admin)" })
  create(@Body() dto: CreateAseguradoraDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Permissions("lectura:campania")
  @ApiOperation({ summary: "Listar empresas de seguros" })
  findAll(@Query("soloActivas") soloActivas?: string) {
    return this.service.findAll(soloActivas === "true" || soloActivas === "1");
  }

  @Get(":id")
  @Permissions("lectura:campania")
  @ApiOperation({ summary: "Obtener una empresa de seguros por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @Permissions("escritura:campania")
  @ApiOperation({
    summary: "Actualizar una empresa de seguros (sys-admin: nombre, activo)",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAseguradoraDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }
}
