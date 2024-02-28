import { InjectionToken } from 'graphql-modules';
import type { DatabasePool } from 'slonik';

export const PG_POOL_CONFIG = new InjectionToken<DatabasePool>('PG_POOL');
