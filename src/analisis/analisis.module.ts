import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Lote } from "../entities/lote.entity";
import { AuthModule } from "../auth/auth.module";
import { AnalisisController } from "./analisis.controller";
import { AnalisisService } from "./analisis.service";
import { NasaPowerService } from "./nasa-power.service";
import { InMemoryPowerCache, POWER_CACHE } from "./power-cache.provider";
import { CdseAuthService } from "./cdse-auth.service";
import { SentinelNdviService } from "./sentinel-ndvi.service";
import { GibsNdviService } from "./gibs-ndvi.service";
import { NdviService } from "./ndvi.service";
import { NDVI_CACHE } from "./ndvi-cache.provider";

@Module({
  imports: [TypeOrmModule.forFeature([Lote]), AuthModule],
  controllers: [AnalisisController],
  providers: [
    AnalisisService,
    NasaPowerService,
    // Cache de POWER en memoria. Para usar Redis a futuro sólo se cambia la
    // implementación de PowerCacheProvider (misma interfaz, mismo token).
    { provide: POWER_CACHE, useClass: InMemoryPowerCache },
    // NDVI: misma interfaz de cache, instancia separada para no mezclar TTLs.
    CdseAuthService,
    SentinelNdviService,
    GibsNdviService,
    NdviService,
    { provide: NDVI_CACHE, useClass: InMemoryPowerCache },
  ],
})
export class AnalisisModule {}
