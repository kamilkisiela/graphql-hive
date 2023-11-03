import type { DocumentNode, GraphQLSchema } from 'graphql';
import type {
  ClientStatsValues,
  OperationStatsValues,
  SchemaChange,
  SchemaError,
} from '../__generated__/types';
import { type SuperGraphInformation } from '../modules/schema/lib/federation-super-graph';
import { SchemaCheckWarning } from '../modules/schema/providers/models/shared';
import { SchemaBuildError } from '../modules/schema/providers/orchestrators/errors';
import { InflatedSchemaCheck } from '../modules/schema/providers/schema-manager';
import { SerializableChange } from '../modules/schema/schema-change-from-meta';
import type {
  ActivityObject,
  DateRange,
  DeletedCompositeSchema as DeletedCompositeSchemaEntity,
  DocumentCollection,
  DocumentCollectionOperation,
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
import { type PromiseOrValue } from './helpers';

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

export type SchemaCoordinateUsageForUnusedExplorer = {
  isUsed: false;
  usedCoordinates: Set<string>;
  period: DateRange;
  organization: string;
  project: string;
  target: string;
};

export type WithSchemaCoordinatesUsage<T> = T & {
  usage: // explorer
  () =>
    | PromiseOrValue<{
        [coordinate: string]: {
          total: number;
          usedByClients: () => PromiseOrValue<Array<string>>;
          period: DateRange;
          organization: string;
          project: string;
          target: string;
          typename: string;
        };
      }>
    | SchemaCoordinateUsageForUnusedExplorer;
};

export type SchemaExplorerMapper = {
  schema: GraphQLSchema;
  usage: {
    period: DateRange;
    organization: string;
    project: string;
    target: string;
  };
  supergraph: null | SuperGraphInformation;
};

export type UnusedSchemaExplorerMapper = {
  sdl: DocumentNode;
  usage: {
    period: DateRange;
    organization: string;
    project: string;
    target: string;
    usedCoordinates: Set<string>;
  };
  supergraph: null | SuperGraphInformation;
};

export type GraphQLFieldMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: {
      name: string;
      description?: string | null;
      deprecationReason?: string | null;
      type: string;
      args: Array<GraphQLArgumentMapper['entity']>;
    };
    supergraph: null | {
      ownedByServiceNames: Array<string> | null;
    };
  }>
>;
export type GraphQLInputFieldMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: {
      name: string;
      description?: string | null;
      deprecationReason?: string | null;
      defaultValue?: unknown;
      type: string;
    };
    supergraph: null | {
      ownedByServiceNames: Array<string> | null;
    };
  }>
>;
export type GraphQLEnumValueMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: {
      name: string;
      description?: string | null;
      deprecationReason?: string | null;
    };
    supergraph: null | {
      ownedByServiceNames: Array<string> | null;
    };
  }>
>;
export type GraphQLArgumentMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: {
      name: string;
      description?: string | null;
      deprecationReason?: string | null;
      defaultValue?: unknown;
      type: string;
    };
  }>
>;

export type GraphQLNamedTypeMapper =
  | GraphQLUnionTypeMapper
  | GraphQLObjectTypeMapper
  | GraphQLInterfaceTypeMapper
  | GraphQLScalarTypeMapper
  | GraphQLEnumTypeMapper
  | GraphQLInputObjectTypeMapper;

export type GraphQLUnionTypeMemberMapper = WithSchemaCoordinatesUsage<
  WithGraphQLParentInfo<{
    entity: {
      name: string;
    };
    supergraph: null | {
      ownedByServiceNames: Array<string> | null;
    };
  }>
>;

export type GraphQLObjectTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: 'object';
    name: string;
    description?: string | null;
    fields: Array<GraphQLFieldMapper['entity']>;
    interfaces: string[];
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
    getFieldOwnedByServices: (fieldName: string) => Array<string> | null;
  };
}>;
export type GraphQLInterfaceTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: 'interface';
    name: string;
    description?: string | null;
    fields: Array<GraphQLFieldMapper['entity']>;
    interfaces: string[];
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
    getFieldOwnedByServices: (fieldName: string) => Array<string> | null;
  };
}>;
export type GraphQLUnionTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: 'union';
    name: string;
    description?: string | null;
    members: Array<GraphQLUnionTypeMemberMapper['entity']>;
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
    getUnionMemberOwnedByServices: (unionMemberName: string) => Array<string> | null;
  };
}>;
export type GraphQLEnumTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: 'enum';
    name: string;
    description?: string | null;
    values: Array<GraphQLEnumValueMapper['entity']>;
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
    getEnumValueOwnedByServices: (fieldName: string) => Array<string> | null;
  };
}>;
export type GraphQLInputObjectTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: 'input-object';
    name: string;
    description?: string | null;
    fields: Array<GraphQLInputFieldMapper['entity']>;
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
    getInputFieldOwnedByServices: (inputFieldName: string) => Array<string> | null;
  };
}>;
export type GraphQLScalarTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: 'scalar';
    name: string;
    description?: string | null;
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
  };
}>;

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
export type OperationStatsValuesConnection = ReadonlyArray<
  Omit<OperationStatsValues, 'duration'> & { duration: DurationValues }
>;
export type ClientStatsValuesConnection = readonly ClientStatsValues[];
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
  clients: readonly string[];
}

export interface SchemaCoordinateStats {
  organization: string;
  project: string;
  target: string;
  period: DateRange;
  schemaCoordinate: string;
}

export interface ClientStats {
  organization: string;
  project: string;
  target: string;
  period: DateRange;
  clientName: string;
}

export interface DurationValues {
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

export type SchemaCoordinateUsageTypeMapper =
  | {
      isUsed: true;
      total: number;
      usedByClients: () => PromiseOrValue<Array<string>>;
      period: DateRange;
      organization: string;
      project: string;
      target: string;
      coordinate: string;
    }
  | {
      isUsed: false;
      total: number;
      usedByClients: () => Array<string>;
    };

export type DocumentCollectionConnection = ReadonlyArray<DocumentCollection>;
export type DocumentCollectionOperationsConnection = ReadonlyArray<DocumentCollectionOperation>;

export type FailedSchemaCheckMapper = {
  __typename: 'FailedSchemaCheck';
  selector: {
    organizationId: string;
    projectId: string;
  };
} & Extract<InflatedSchemaCheck, { isSuccess: false }>;
export type SuccessfulSchemaCheckMapper = {
  __typename: 'SuccessfulSchemaCheck';
  selector: {
    organizationId: string;
    projectId: string;
  };
} & Extract<InflatedSchemaCheck, { isSuccess: true }>;

export type SchemaPolicyWarningConnectionMapper = ReadonlyArray<SchemaCheckWarning>;
