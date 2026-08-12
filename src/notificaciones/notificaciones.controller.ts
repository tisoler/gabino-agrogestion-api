import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificacionesService } from './notificaciones.service';
import { FirebaseGuard } from '../auth/guards/firebase.guard';
import { FirebaseSseGuard } from './guards/sse.guard';

@ApiTags('notificaciones')
@Controller('notificaciones')
@ApiBearerAuth()
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  @Get()
  @UseGuards(FirebaseGuard)
  @ApiOperation({ summary: 'Listar mis notificaciones (más recientes primero)' })
  listar(@Req() req: Request) {
    return this.service.listar((req.user as any).id);
  }

  @Get('no-leidas')
  @UseGuards(FirebaseGuard)
  @ApiOperation({ summary: 'Cantidad de notificaciones no leídas' })
  noLeidas(@Req() req: Request) {
    return this.service.noLeidas((req.user as any).id);
  }

  @Post('marcar-todas-leidas')
  @UseGuards(FirebaseGuard)
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas' })
  marcarTodasLeidas(@Req() req: Request) {
    return this.service.marcarTodasLeidas((req.user as any).id);
  }

  @Post(':id/leer')
  @UseGuards(FirebaseGuard)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  marcarLeida(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.marcarLeida((req.user as any).id, id);
  }

  @Get('stream')
  @UseGuards(FirebaseSseGuard)
  @ApiOperation({
    summary:
      'Stream SSE (EventSource) de notificaciones. El token viaja como ?token= porque EventSource no manda headers.',
  })
  stream(@Req() req: Request, @Res() res: Response) {
    this.service.suscribir((req.user as any).id, res);
  }
}
