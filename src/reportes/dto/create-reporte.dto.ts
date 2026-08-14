import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoReporte, TipoCosecha } from '../../entities/reporte.entity';

export class ReporteFilaDto {
  @IsInt()
  @Min(1)
  idLote: number;

  /** Producción (detalle_asesoramiento). */
  @IsOptional()
  @IsInt()
  idProduccion?: number;

  /** Producción de cosecha fina (resumen_campania). */
  @IsOptional()
  @IsInt()
  idProduccionFina?: number;

  /** Producción de cosecha gruesa (resumen_campania). */
  @IsOptional()
  @IsInt()
  idProduccionGruesa?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  porcentajeAsesoramiento?: number;
}

export class CreateReporteDto {
  @IsInt()
  @Min(1)
  idEmpresa: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 7)
  campania: string;

  @IsIn(['resumen_campania', 'detalle_asesoramiento'])
  tipo: TipoReporte;

  @IsOptional()
  @IsIn(['fina', 'gruesa'])
  tipoCosecha?: TipoCosecha;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  asesoramientoPorcentaje?: number;

  @IsOptional()
  @IsBoolean()
  aplicaIva?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReporteFilaDto)
  filas: ReporteFilaDto[];
}
