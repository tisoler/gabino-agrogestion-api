import type { ColumnOptions, ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value ?? null,
  from: (value: string | null) => (value == null ? null : parseFloat(value)),
};

export function decimalColumn(options: ColumnOptions = {}): ColumnOptions {
  return { type: 'decimal', precision: 14, scale: 4, transformer: decimalTransformer, ...options };
}