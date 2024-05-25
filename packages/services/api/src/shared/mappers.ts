import type { SchemaChangeType } from '@hive/storage';
import type { SchemaBuildError } from '../modules/schema/providers/orchestrators/errors';
import type {
  DeletedCompositeSchema as DeletedCompositeSchemaEntity,
  DocumentCollection,
  DocumentCollectionOperation,
} from './entities';

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

export type DeletedCompositeSchema = DeletedCompositeSchemaEntity;

export type TargetsEstimationDateFilter = {
  startTime: Date;
  endTime: Date;
};

export type TargetsEstimationFilter = TargetsEstimationDateFilter &
  (
    | {
        target: string;
      }
    | {
        organization: string;
      }
  );

export type DocumentCollectionConnection = ReadonlyArray<DocumentCollection>;
export type DocumentCollectionOperationsConnection = ReadonlyArray<DocumentCollectionOperation>;
