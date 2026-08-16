import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CamposService } from "./campos.service";
import { CreateCampoDto } from "./dto/create-campo.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("campos")
@Controller("campos")
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class CamposController {
  constructor(private readonly camposService: CamposService) {}

  @Post()
  @Permissions("escritura:lote")
  @ApiOperation({ summary: "Crear un campo" })
  create(@Body() createCampoDto: CreateCampoDto) {
    return this.camposService.create(createCampoDto);
  }

  @Get()
  @Permissions("lectura:lote")
  @ApiOperation({ summary: "Listar campos" })
  findAll() {
    return this.camposService.findAll();
  }

  @Get(":id")
  @Permissions("lectura:lote")
  @ApiOperation({ summary: "Obtener un campo por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.camposService.findOne(id);
  }
}
