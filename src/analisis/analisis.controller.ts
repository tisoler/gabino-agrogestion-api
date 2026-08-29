import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { AnalisisService } from "./analisis.service";
import { FirebaseGuard } from "../auth/guards/firebase.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { Roles as RolesConst } from "../constantes";

@ApiTags("analisis")
@Controller("analisis")
@UseGuards(FirebaseGuard, PermissionsGuard, RolesGuard)
@ApiBearerAuth()
export class AnalisisController {
  constructor(private readonly service: AnalisisService) {}

  @Get("lote/:idLote/clima")
  @Permissions("lectura:analisis-clima")
  @Roles(RolesConst.SYS_ADMIN, RolesConst.ASESOR, RolesConst.ASESOR_ADMIN)
  @ApiOperation({
    summary: "Clima histórico/actual de un lote (NASA POWER)",
    description:
      "Consolida temperatura (media/máx/mín), humedad relativa, lluvia y GDD " +
      "de un lote. `periodo` = actual | mes | campania. En 'mes' se devuelve " +
      "además la serie multi-año (10 años) del mismo mes.",
  })
  @ApiQuery({
    name: "periodo",
    required: false,
    enum: ["actual", "mes", "campania"],
  })
  @ApiQuery({ name: "fecha", required: false, description: "YYYY-MM o YY/YY" })
  clima(
    @Param("idLote", ParseIntPipe) idLote: number,
    @Query("periodo") periodo?: string,
    @Query("fecha") fecha?: string,
    @Request() req?: { user?: any },
  ) {
    return this.service.clima(idLote, req?.user, periodo, fecha);
  }
}
