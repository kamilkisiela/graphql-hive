import type { DocumentNode, GraphQLSchema, Kind } from 'graphql';
import type {
  SchemaChangeType,
  SchemaCheck,
  SchemaVersion as SchemaVersionEntity,
} from '@hive/storage';
import type { ClientStatsValues, OperationStatsValues } from '../__generated__/types';
import type { SuperGraphInformation } from '../modules/schema/lib/federation-super-graph';
import type { SchemaCheckWarning } from '../modules/schema/providers/models/shared';
import type { SchemaBuildError } from '../modules/schema/providers/orchestrators/errors';
import type {
  ActivityObject,
  DateRange,
  DeletedCompositeSchema as DeletedCompositeSchemaEntity,
  DocumentCollection,
  DocumentCollectionOperation,
  Member,
  Organization,
  OrganizationMemberRole,
  Project,
  PushedCompositeSchema as PushedCompositeSchemaEntity,
  SingleSchema as SingleSchemaEntity,
  Target,
  Token,
  User,
} from './entities';
import type { PromiseOrValue } from './helpers';

export type { Contract } from '../modules/schema/providers/contracts';

export type BreakingChangeMetadataTarget = {
  name: string;
  id: string;
};

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
