import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirestoreCacheService } from './firestore-cache.service';
import { FirebaseGuard } from '../auth/guards/firebase.guard';

@ApiTags('cache')
@Controller('cache')
@UseGuards(FirebaseGuard)
@ApiBearerAuth()
export class CacheController {
  constructor(private readonly cache: FirestoreCacheService) {}

  @Post('invalidate')
  @ApiOperation({
    summary: 'Limpiar todos los caches (auth por usuario y listado de usuarios)',
  })
  invalidate() {
    this.cache.invalidateAll();
    return { ok: true };
  }
}
