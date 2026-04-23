import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { EmpresasModule } from './empresas/empresas.module';
import { LaboresModule } from './labores/labores.module';
import { InsumosModule } from './insumos/insumos.module';
import { CostosModule } from './costos/costos.module';
import { ProductoresModule } from './productores/productores.module';
import { CultivosModule } from './cultivos/cultivos.module';

import { Empresa } from './entities/empresa.entity';
import { Labor } from './entities/labor.entity';
import { Insumo } from './entities/insumo.entity';
import { Costo } from './entities/costo.entity';
import { Campania } from './entities/campania.entity';
import { Productor } from './entities/productor.entity';
import { Lote } from './entities/lote.entity';
import { Cultivo } from './entities/cultivo.entity';
import { Variedad } from './entities/variedad.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [
          Empresa,
          Labor,
          Insumo,
          Costo,
          Campania,
          Productor,
          Lote,
          Cultivo,
          Variedad,
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
    ProductoresModule,
    CultivosModule,
  ],
})
export class AppModule {}
