import type { ClientStatsValues, OperationStatsValues } from '../../__generated__/types';
import type { DateRange } from '../../shared/entities';

export type OperationStatsValuesConnectionMapper = ReadonlyArray<
  Omit<OperationStatsValues, 'duration'> & { duration: DurationValuesMapper }
>;
export type ClientStatsValuesConnectionMapper = readonly ClientStatsValues[];
export interface SchemaCoordinateStatsMapper {
  organization: string;
  project: string;
  target: string;
  period: DateRange;
  schemaCoordinate: string;
}
export interface ClientStatsMapper {
  organization: string;
  project: string;
  target: string;
  period: DateRange;
  clientName: string;
}
export interface OperationsStatsMapper {
  organization: string;
  project: string;
  target: string;
  period: DateRange;
  operations: readonly string[];
  clients: readonly string[];
}
export interface DurationValuesMapper {
  p75: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
}
