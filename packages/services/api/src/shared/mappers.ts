import type { SchemaChangeType } from '@hive/storage';
import type { SchemaBuildError } from '../modules/schema/providers/orchestrators/errors';

export type SchemaComparePayload = SchemaCompareResult | SchemaCompareError;

export type SchemaCompareError = {
  error: SchemaBuildError;
  result?: never;
};

export type SchemaCompareResult = {
  error?: never;
  result: {
    schemas: {
      before: string | null;
      current: string;
    };
    changes: Array<SchemaChangeType>;
    versionIds: {
      before: string | null;
      current: string;
    } | null;
  };
};
