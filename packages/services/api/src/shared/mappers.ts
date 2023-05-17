import type {
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
} from 'graphql';
import type {
  ClientStats,
  OperationStats,
  SchemaChange,
  SchemaError,
} from '../__generated__/types';
import { SchemaCheckWarning } from '../modules/schema/providers/models/shared';
import { SchemaBuildError } from '../modules/schema/providers/orchestrators/errors';
import { SerializableChange } from '../modules/schema/schema-change-from-meta';
import type {
  ActivityObject,
  DateRange,
  DeletedCompositeSchema as DeletedCompositeSchemaEntity,
  Member,
  Organization,
  PersistedOperation,
  Project,
  PushedCompositeSchema as PushedCompositeSchemaEntity,
  SchemaVersion as SchemaVersionEntity,
  SingleSchema as SingleSchemaEntity,
  Target,
  Token,
  User,
} from './entities';

export interface SchemaVersion extends SchemaVersionEntity {
  project: string;
  target: string;
  organization: string;
}

export type WithGraphQLParentInfo<T> = T & {
  parent: {
    coordinate: string;
  };
};

export type WithSchemaCoordinatesUsage<T> = T & {
  usage: Promise<{
    [coordinate: string]: {
      total: number;
    };
  }>;
};

export type SchemaExplorerMapper = {
  schema: GraphQLSchema;
  usage: {
    period: DateRange;
    organization: string;
    project: string;
    target: string;
  };
};

export type GraphQLFieldMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: GraphQLField<any, any, any>;
  }>
>;
export type GraphQLInputFieldMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: GraphQLInputField;
  }>
>;
export type GraphQLEnumValueMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{ entity: GraphQLEnumValue }>
>;
export type GraphQLArgumentMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{ entity: GraphQLArgument }>
>;
export type GraphQLUnionTypeMemberMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: GraphQLObjectType;
  }>
>;

export type GraphQLObjectTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLObjectType }>;
export type GraphQLInterfaceTypeMapper = WithSchemaCoordinatesUsage<{
  entity: GraphQLInterfaceType;
}>;
export type GraphQLUnionTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLUnionType }>;
export type GraphQLEnumTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLEnumType }>;
export type GraphQLInputObjectTypeMapper = WithSchemaCoordinatesUsage<{
  entity: GraphQLInputObjectType;
}>;
export type GraphQLScalarTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLScalarType }>;

export type SchemaChangeConnection = ReadonlyArray<SchemaChange>;
export type SchemaErrorConnection = readonly SchemaError[];
export type SchemaWarningConnection = readonly SchemaCheckWarning[];
export type UserConnection = readonly User[];
export type MemberConnection = readonly Member[];
export type ActivityConnection = readonly ActivityObject[];
export type OrganizationConnection = readonly Organization[];
export type ProjectConnection = readonly Project[];
export type TargetConnection = readonly Target[];
export type PersistedOperationConnection = readonly PersistedOperation[];
export type SchemaConnection = readonly Schema[];
export type TokenConnection = readonly Token[];
export type OperationStatsConnection = ReadonlyArray<
  Omit<OperationStats, 'duration'> & { duration: DurationStats }
>;
export type ClientStatsConnection = readonly ClientStats[];
export type SchemaVersionConnection = {
  nodes: readonly SchemaVersion[];
  hasMore: boolean;
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
    changes: Array<SerializableChange>;
    versionIds: {
      before: string | null;
      current: string;
    } | null;
  };
};

export type SingleSchema = SingleSchemaEntity;
export type PushedCompositeSchema = PushedCompositeSchemaEntity;
export type DeletedCompositeSchema = DeletedCompositeSchemaEntity;
export type Schema = SingleSchema | PushedCompositeSchema;

export interface OperationsStats {
  organization: string;
  project: string;
  target: string;
  period: DateRange;
  operations: readonly string[];
}

export interface DurationStats {
  p75: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
}

export type TargetsEstimationDateFilter = {
  startTime: Date;
  endTime: Date;
};

export type TargetsEstimationFilter = TargetsEstimationDateFilter & {
  targets: string[];
};

export type AdminStats = {
  period: {
    from: string;
    to: string;
  };
};
