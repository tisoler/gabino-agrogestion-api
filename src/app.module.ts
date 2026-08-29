import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { EmpresasModule } from "./empresas/empresas.module";
import { LaboresModule } from "./labores/labores.module";
import { InsumosModule } from "./insumos/insumos.module";
import { CostosModule } from "./costos/costos.module";
import { CultivosModule } from "./cultivos/cultivos.module";
import { CategoriasModule } from "./categorias/categorias.module";
import { CamposModule } from "./campos/campos.module";
import { LotesModule } from "./lotes/lotes.module";
import { UsuariosModule } from "./usuarios/usuarios.module";
import { CampaniasModule } from "./campanias/campanias.module";
import { PrescripcionesModule } from "./prescripciones/prescripciones.module";
import { CotizacionesModule } from "./cotizaciones/cotizaciones.module";
import { NotificacionesModule } from "./notificaciones/notificaciones.module";
import { ReportesModule } from "./reportes/reportes.module";
import { MensajesMasivosModule } from "./mensajes-masivos/mensajes-masivos.module";
import { CacheModule } from "./cache/cache.module";
import { AnalisisModule } from "./analisis/analisis.module";

import { Empresa } from "./entities/empresa.entity";
import { Labor } from "./entities/labor.entity";
import { Insumo } from "./entities/insumo.entity";
import { Costo } from "./entities/costo.entity";
import { Campania } from "./entities/campania.entity";
import { CampaniaLabor } from "./entities/campania-labor.entity";
import { CampaniaInsumo } from "./entities/campania-insumo.entity";
import { CampaniaCosto } from "./entities/campania-costo.entity";
import { Lote } from "./entities/lote.entity";
import { Cultivo } from "./entities/cultivo.entity";
import { Variedad } from "./entities/variedad.entity";
import { CategoriaInsumo } from "./entities/categoria-insumo.entity";
import { Campo } from "./entities/campo.entity";
import { Prescripcion } from "./entities/prescripcion.entity";
import { PrescripcionInsumo } from "./entities/prescripcion-insumo.entity";
import { Notificacion } from "./entities/notificacion.entity";
import { Reporte } from "./entities/reporte.entity";
import { ReporteFila } from "./entities/reporte-fila.entity";
import { MensajeMasivo } from "./entities/mensaje-masivo.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("DB_HOST"),
        port: configService.get<number>("DB_PORT"),
        username: configService.get<string>("DB_USERNAME"),
        password: configService.get<string>("DB_PASSWORD"),
        database: configService.get<string>("DB_DATABASE"),
        entities: [
          Empresa,
          Labor,
          Insumo,
          Costo,
          Campania,
          CampaniaLabor,
          CampaniaInsumo,
          CampaniaCosto,
          Lote,
          Cultivo,
          Variedad,
          CategoriaInsumo,
          Campo,
          Prescripcion,
          PrescripcionInsumo,
          Notificacion,
          Reporte,
          ReporteFila,
          MensajeMasivo,
        ],
        synchronize: false, // Migraciones manuales
        logging: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    EmpresasModule,
    LaboresModule,
    InsumosModule,
    CostosModule,
    CultivosModule,
    CategoriasModule,
    CamposModule,
    LotesModule,
    UsuariosModule,
    CampaniasModule,
    PrescripcionesModule,
    CotizacionesModule,
    NotificacionesModule,
    ReportesModule,
    MensajesMasivosModule,
    CacheModule,
    AnalisisModule,
  ],
})
export class AppModule {}
