import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Request,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnalisisSueloService } from "./analisis-suelo.service";
import { CreateAnalisisSueloDto } from "./dto/create-analisis-suelo.dto";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";

/**
 * Análisis de suelo por lote. El archivo original NO se guarda: se extrae
 * vía OCR, se devuelve como preview y el usuario acepta o ajusta antes de
 * guardar (POST sin /extraer).
 */
@ApiTags("analisis-suelo")
@Controller()
@UseGuards(FirebaseGuard, PermissionsGuard)
@ApiBearerAuth()
export class AnalisisSueloController {
  constructor(private readonly service: AnalisisSueloService) {}

  @Get("analisis-suelo/parametros")
  @Permissions("lectura:lote")
  @ApiOperation({
    summary: "Catálogo de parámetros (para agregar filas manuales)",
  })
  parametros() {
    return this.service.parametros();
  }

  @Get("lotes/:idLote/analisis-suelo")
  @Permissions("lectura:lote")
  @ApiOperation({ summary: "Listar análisis de suelo del lote" })
  findAll(@Param("idLote", ParseIntPipe) idLote: number, @Request() req) {
    return this.service.findAll(idLote, req.user);
  }

  @Post("lotes/:idLote/analisis-suelo/extraer")
  @Permissions("escritura:lote")
  @UseInterceptors(
    FileInterceptor("archivo", {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary:
      "Extraer datos de un informe (PDF o imagen) sin guardar: preview para aceptar o ajustar",
  })
  extraer(
    @Param("idLote", ParseIntPipe) idLote: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Request() req,
  ) {
    return this.service.extraer(idLote, req.user, archivo);
  }

  @Post("lotes/:idLote/analisis-suelo")
  @Permissions("escritura:lote")
  @ApiOperation({ summary: "Guardar un análisis de suelo (tras preview)" })
  create(
    @Param("idLote", ParseIntPipe) idLote: number,
    @Body() dto: CreateAnalisisSueloDto,
    @Request() req,
  ) {
    return this.service.create(idLote, dto, req.user);
  }

  @Delete("analisis-suelo/:id")
  @Permissions("escritura:lote")
  @ApiOperation({ summary: "Eliminar un análisis de suelo" })
  remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user);
  }
}
