import type { DocumentNode, GraphQLSchema, Kind } from 'graphql';
import type { SchemaChangeType, SchemaCheck, SchemaCheckApprovalMetadata } from '@hive/storage';
import type { SchemaError } from '../../__generated__/types';
import type { DateRange, PushedCompositeSchema, SingleSchema } from '../../shared/entities';
import type { PromiseOrValue } from '../../shared/helpers';
import type { ContractGraph } from '../graph/providers/graph-store';
import type { SuperGraphInformation } from './lib/federation-super-graph';
import type {
  ContractCheck,
  ContractVersion,
  PaginatedContractConnection,
} from './providers/contracts';
import type { SchemaCheckWarning } from './providers/models/shared';
import type { SchemaVersion } from './providers/schema-version-store';

export type SchemaChangeConnectionMapper = ReadonlyArray<SchemaChangeMapper>;
export type SchemaChangeMapper = SchemaChangeType;
export type SchemaChangeApprovalMapper = SchemaCheckApprovalMetadata;
export type SchemaErrorConnectionMapper = readonly SchemaError[];
export type SchemaWarningConnectionMapper = readonly SchemaCheckWarning[];
export type SchemaConnectionMapper = readonly SchemaMapper[];
export type SchemaVersionConnectionMapper = Readonly<{
  edges: ReadonlyArray<{
    cursor: string;
    node: SchemaVersion & {
      organizationId: string;
      projectId: string;
      targetId: string;
    };
  }>;
  pageInfo: Readonly<{
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  }>;
}>;
export type SchemaVersionMapper = SchemaVersion & {
  projectId: string;
  targetId: string;
  organizationId: string;
};
export type SingleSchemaMapper = SingleSchema;
export type CompositeSchemaMapper = PushedCompositeSchema;
export type SchemaMapper = SingleSchemaMapper | CompositeSchemaMapper; // TODO: eddeee888 to check if union is wired up correctly by Server Preset
export type SchemaExplorerMapper = {
  schema: GraphQLSchema;
  usage: {
    period: DateRange;
    organizationId: string;
    projectId: string;
    targetId: string;
  };
  supergraph: null | SuperGraphInformation;
};
export type UnusedSchemaExplorerMapper = {
  sdl: DocumentNode;
  usage: {
    period: DateRange;
    organizationId: string;
    projectId: string;
    targetId: string;
    usedCoordinates: Set<string>;
  };
  supergraph: null | SuperGraphInformation;
};
export type DeprecatedSchemaExplorerMapper = {
  sdl: DocumentNode;
  usage: {
    period: DateRange;
    organizationId: string;
    projectId: string;
    targetId: string;
  };
  supergraph: null | SuperGraphInformation;
};

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
export type WithGraphQLParentInfo<T> = T & {
  parent: {
    coordinate: string;
  };
};
export type SchemaCoordinateUsageForUnusedExplorer = {
  isUsed: false;
  usedCoordinates: Set<string>;
  period: DateRange;
  organizationId: string;
  projectId: string;
  targetId: string;
};
export type WithSchemaCoordinatesUsage<T> = T & {
  usage: // explorer
  () =>
    | PromiseOrValue<{
        [coordinate: string]: {
          total: number;
          totalResolutions?: number | null;
          errorTotal?: number | null;
          usedByClients: () => PromiseOrValue<Array<string>>;
          period: DateRange;
          organizationId: string;
          projectId: string;
          targetId: string;
          typename: string;
        };
      }>
    | SchemaCoordinateUsageForUnusedExplorer;
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
      schemaMetadata: Array<SchemaMetadataMapper> | null;
    };
  }>
>;
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
export type GraphQLObjectTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: Kind.OBJECT_TYPE_DEFINITION;
    name: string;
    description?: string | null;
    fields: Array<GraphQLFieldMapper['entity']>;
    interfaces: string[];
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
    getFieldMetadata: (fieldName: string) => Array<SchemaMetadataMapper> | null;
    getFieldOwnedByServices: (fieldName: string) => Array<string> | null;
  };
}>;
export type GraphQLInterfaceTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: Kind.INTERFACE_TYPE_DEFINITION;
    name: string;
    description?: string | null;
    fields: Array<GraphQLFieldMapper['entity']>;
    interfaces: string[];
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
    getFieldMetadata: (fieldName: string) => Array<SchemaMetadataMapper> | null;
    getFieldOwnedByServices: (fieldName: string) => Array<string> | null;
  };
}>;
export type GraphQLUnionTypeMapper = WithSchemaCoordinatesUsage<{
  entity: {
    kind: Kind.UNION_TYPE_DEFINITION;
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
    kind: Kind.ENUM_TYPE_DEFINITION;
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
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION;
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
    kind: Kind.SCALAR_TYPE_DEFINITION;
    name: string;
    description?: string | null;
  };
  supergraph: null | {
    ownedByServiceNames: Array<string> | null;
  };
}>;
export type GraphQLNamedTypeMapper =
  | GraphQLUnionTypeMapper
  | GraphQLObjectTypeMapper
  | GraphQLInterfaceTypeMapper
  | GraphQLScalarTypeMapper
  | GraphQLEnumTypeMapper
  | GraphQLInputObjectTypeMapper;

export type SchemaCoordinateUsageMapper =
  | {
      isUsed: true;
      total: number;
      totalResolutions?: number | null;
      errorTotal?: number | null;
      usedByClients: () => PromiseOrValue<Array<string>>;
      period: DateRange;
      organizationId: string;
      projectId: string;
      targetId: string;
      coordinate: string;
    }
  | {
      isUsed: false;
      total: number;
      totalResolutions?: number | null;
      errorTotal?: number | null;
      usedByClients: () => Array<string>;
    };

export type FailedSchemaCheckMapper = {
  __typename: 'FailedSchemaCheck';
  selector: {
    organizationId: string;
    projectId: string;
  };
} & Extract<SchemaCheck, { isSuccess: false }>;

export type SuccessfulSchemaCheckMapper = {
  __typename: 'SuccessfulSchemaCheck';
  selector: {
    organizationId: string;
    projectId: string;
  };
} & Extract<SchemaCheck, { isSuccess: true }>;

export type SchemaPolicyWarningConnectionMapper = ReadonlyArray<SchemaCheckWarning>;

export type ContractMapper = ContractGraph;
export type ContractConnectionMapper = PaginatedContractConnection;
export type ContractCheckMapper = ContractCheck;
export type ContractVersionMapper = ContractVersion;

export type BreakingChangeMetadataTargetMapper = {
  name: string;
  id: string;
};

export type SchemaMetadataMapper = {
  name: string;
  content: string;
  source: string | null;
};

export type SchemaChangeUsageStatisticsAffectedOperationMapper = {
  name: string;
  hash: string;
  count: number;
  percentage: number;
  targetIds: Array<string>;
};

export type SchemaChangeAffectedAppDeploymentMapper = {
  id: string;
  name: string;
  version: string;
  createdAt: string | null;
  activatedAt: string | null;
  retiredAt: string | null;
  status: 'pending' | 'active' | 'retired';
  operations: Array<{
    hash: string;
    name: string | null;
  }>;
  totalOperations: number;
};

export type SchemaChangeAffectedAppDeploymentOperationsConnectionMapper = {
  edges: Array<{
    cursor: string;
    node: {
      hash: string;
      name: string | null;
    };
  }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  };
};

export type SchemaChangeAffectedAppDeploymentsConnectionMapper = {
  edges: Array<{
    cursor: string;
    node: SchemaChangeAffectedAppDeploymentMapper;
  }>;
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  };
};
