import type {
  GraphQLField,
  GraphQLInputField,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLEnumValue,
  GraphQLSchema,
  GraphQLArgument,
} from 'graphql';
import type { SchemaChange, SchemaError, OperationStats, ClientStats } from '../__generated__/types';
import type {
  Member,
  Organization,
  PersistedOperation,
  Project,
  SchemaObject,
  SchemaVersion as SchemaVersionEntity,
  Target,
  Token,
  User,
  ActivityObject,
  DateRange,
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
  usage: {
    [coordinate: string]: {
      total: number;
    };
  };
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
export type GraphQLEnumValueMapper = WithSchemaCoordinatesUsage<WithGraphQLParentInfo<{ entity: GraphQLEnumValue }>>;
export type GraphQLArgumentMapper = WithSchemaCoordinatesUsage<WithGraphQLParentInfo<{ entity: GraphQLArgument }>>;
export type GraphQLUnionTypeMemberMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: GraphQLObjectType;
  }>
>;

export type GraphQLObjectTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLObjectType }>;
export type GraphQLInterfaceTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLInterfaceType }>;
export type GraphQLUnionTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLUnionType }>;
export type GraphQLEnumTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLEnumType }>;
export type GraphQLInputObjectTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLInputObjectType }>;
export type GraphQLScalarTypeMapper = WithSchemaCoordinatesUsage<{ entity: GraphQLScalarType }>;

export type SchemaChangeConnection = readonly SchemaChange[];
export type SchemaErrorConnection = readonly SchemaError[];
export type UserConnection = readonly User[];
export type MemberConnection = readonly Member[];
export type ActivityConnection = readonly ActivityObject[];
export type OrganizationConnection = readonly Organization[];
export type ProjectConnection = readonly Project[];
export type TargetConnection = readonly Target[];
export type PersistedOperationConnection = readonly PersistedOperation[];
export type SchemaConnection = readonly Schema[];
export type TokenConnection = readonly Token[];
export type OperationStatsConnection = ReadonlyArray<Omit<OperationStats, 'duration'> & { duration: DurationStats }>;
export type ClientStatsConnection = readonly ClientStats[];
export type SchemaVersionConnection = {
  nodes: readonly SchemaVersion[];
  hasMore: boolean;
};
export type SchemaComparePayload =
  | SchemaCompareResult
  | {
      message: string;
    };
export type SchemaCompareResult = readonly [SchemaObject, SchemaObject] | readonly [undefined | null, SchemaObject];
export interface Schema {
  id: string;
  author: string;
  source: string;
  date: string;
  service?: string | null;
}

export interface OperationsStats {
  organization: string;
  project: string;
  target: string;
  period: DateRange;
  operations: readonly string[];
}

export interface DurationStats {
  '75.0': number | null;
  '90.0': number | null;
  '95.0': number | null;
  '99.0': number | null;
}

export type TargetsEstimationDateFilter = {
  startTime: Date;
  endTime: Date;
};

export type TargetsEstimationFilter = TargetsEstimationDateFilter & {
  targets: string[];
};
