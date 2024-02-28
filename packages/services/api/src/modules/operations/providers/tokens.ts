import { InjectionToken } from 'graphql-modules';

export interface ClickHouseConfig {
  host: string;
  port: number;
  protocol?: string;
  username?: string;
  password?: string;
  /**
   * In milliseconds
   */
  requestTimeout?: number;
  onReadEnd?: (
    label: string,
    timings: {
      totalSeconds: number;
      elapsedSeconds?: number;
    },
  ) => void;
}

export const CLICKHOUSE_CONFIG = new InjectionToken<ClickHouseConfig>('clickhouse-config');
