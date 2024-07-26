import type {
  GraphQLNamedTypeMapper,
  SchemaCoordinateUsageForUnusedExplorer,
  SchemaCoordinateUsageMapper,
  WithGraphQLParentInfo,
  WithSchemaCoordinatesUsage,
} from './module.graphql.mappers';
import stringify from 'fast-json-stable-stringify';
import { Kind } from 'graphql';
import { createDummyConnection } from '../../shared/schema';
import { TargetManager } from '../target/providers/target-manager';
import type { SchemaModule } from './__generated__/types';
import { ContractsManager } from './providers/contracts-manager';
import { SchemaCheckManager } from './providers/schema-check-manager';
import { SchemaManager } from './providers/schema-manager';

function isSchemaCoordinateUsageForUnusedExplorer(
  value: unknown,
): value is SchemaCoordinateUsageForUnusedExplorer {
  return 'isUsed' in (value as any);
}

function usage(
  source:
    | WithSchemaCoordinatesUsage<{
        entity: {
          name: string;
        };
      }>
    | WithGraphQLParentInfo<
        WithSchemaCoordinatesUsage<{
          entity: {
            name: string;
          };
        }>
      >,
  _: unknown,
): Promise<SchemaCoordinateUsageMapper> | SchemaCoordinateUsageMapper {
  const coordinate =
    'parent' in source ? `${source.parent.coordinate}.${source.entity.name}` : source.entity.name;

  const usage = source.usage();

  if (isSchemaCoordinateUsageForUnusedExplorer(usage)) {
    if (usage.usedCoordinates.has(coordinate)) {
      return {
        // TODO: This is a hack to mark the field as used but without passing exact number as we don't need the exact number in "Unused schema view".
        total: 1,
        isUsed: true,
        usedByClients: () => [],
        period: usage.period,
        organization: usage.organization,
        project: usage.project,
        target: usage.target,
        coordinate: coordinate,
      };
    }

    return {
      total: 0,
      isUsed: false,
      usedByClients: () => [],
    };
  }

  return Promise.resolve(usage).then(usage => {
    const coordinateUsage = usage[coordinate];

    return coordinateUsage && coordinateUsage.total > 0
      ? {
          total: coordinateUsage.total,
          isUsed: true,
          usedByClients: coordinateUsage.usedByClients,
          period: coordinateUsage.period,
          organization: coordinateUsage.organization,
          project: coordinateUsage.project,
          target: coordinateUsage.target,
          coordinate: coordinate,
        }
      : {
          total: 0,
          isUsed: false,
          usedByClients: () => [],
        };
  });
}

function __isTypeOf<
  T extends GraphQLNamedTypeMapper,
  K extends GraphQLNamedTypeMapper['entity']['kind'],
>(kind: K): (type: T) => boolean {
  return ({ entity }: { entity: GraphQLNamedTypeMapper['entity'] }) => entity.kind === kind;
}

export const resolvers: SchemaModule.Resolvers = {
  GraphQLUnionType: {
    __isTypeOf: __isTypeOf(Kind.UNION_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    members: t =>
      t.entity.members.map(i => {
        return {
          entity: i,
          usage: t.usage,
          parent: {
            coordinate: t.entity.name,
          },
          supergraph: t.supergraph
            ? {
                ownedByServiceNames: t.supergraph.getUnionMemberOwnedByServices(i.name),
              }
            : null,
        };
      }),
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLEnumType: {
    __isTypeOf: __isTypeOf(Kind.ENUM_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    values: t =>
      t.entity.values.map(v => ({
        entity: v,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
        supergraph: t.supergraph
          ? { ownedByServiceNames: t.supergraph.getEnumValueOwnedByServices(v.name) }
          : null,
      })),
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLInputObjectType: {
    __isTypeOf: __isTypeOf(Kind.INPUT_OBJECT_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    fields: t =>
      t.entity.fields.map(f => ({
        entity: f,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
        supergraph: t.supergraph
          ? {
              ownedByServiceNames: t.supergraph.getInputFieldOwnedByServices(f.name),
            }
          : null,
      })),
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLScalarType: {
    __isTypeOf: __isTypeOf(Kind.SCALAR_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    usage,
    supergraphMetadata: t =>
      t.supergraph ? { ownedByServiceNames: t.supergraph.ownedByServiceNames } : null,
  },
  GraphQLEnumValue: {
    name: v => v.entity.name,
    description: v => v.entity.description ?? null,
    isDeprecated: v => typeof v.entity.deprecationReason === 'string',
    deprecationReason: v => v.entity.deprecationReason ?? null,
    usage,
    supergraphMetadata: v =>
      v.supergraph ? { ownedByServiceNames: v.supergraph.ownedByServiceNames } : null,
  },
  GraphQLUnionTypeMember: {
    name: m => m.entity.name,
    usage,
    supergraphMetadata: m =>
      m.supergraph ? { ownedByServiceNames: m.supergraph.ownedByServiceNames } : null,
  },
  GraphQLField: {
    name: f => f.entity.name,
    description: f => f.entity.description ?? null,
    isDeprecated: f => typeof f.entity.deprecationReason === 'string',
    deprecationReason: f => f.entity.deprecationReason ?? null,
    type: f => f.entity.type,
    args: f =>
      f.entity.args.map(a => ({
        entity: a,
        parent: {
          coordinate: `${f.parent.coordinate}.${f.entity.name}`,
        },
        usage: f.usage,
      })),
    usage,
    supergraphMetadata: f =>
      f.supergraph
        ? {
            ownedByServiceNames: f.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLInputField: {
    name: f => f.entity.name,
    description: f => f.entity.description ?? null,
    type: f => f.entity.type,
    defaultValue: f => stringifyDefaultValue(f.entity.defaultValue),
    isDeprecated: f => typeof f.entity.deprecationReason === 'string',
    deprecationReason: f => f.entity.deprecationReason ?? null,
    usage,
    supergraphMetadata: f =>
      f.supergraph
        ? {
            ownedByServiceNames: f.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLArgument: {
    name: a => a.entity.name,
    description: a => a.entity.description ?? null,
    type: a => a.entity.type,
    defaultValue: a => stringifyDefaultValue(a.entity.defaultValue),
    deprecationReason: a => a.entity.deprecationReason ?? null,
    isDeprecated: a => typeof a.entity.deprecationReason === 'string',
    usage,
  },
  SuccessfulSchemaCheck: {
    schemaVersion(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
    },
    safeSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
    },
    breakingSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getBreakingSchemaChanges(schemaCheck);
    },
    hasSchemaCompositionErrors(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaCompositionErrors(schemaCheck);
    },
    hasSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaChanges(schemaCheck);
    },
    hasUnapprovedBreakingChanges() {
      return false;
    },
    webUrl(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getSchemaCheckWebUrl({
        schemaCheckId: schemaCheck.id,
        targetId: schemaCheck.targetId,
      });
    },
    isApproved(schemaCheck) {
      return schemaCheck.isManuallyApproved;
    },
    approvedBy(schemaCheck, _, { injector }) {
      return schemaCheck.isManuallyApproved
        ? injector.get(SchemaManager).getApprovedByUser({
            organizationId: schemaCheck.selector.organizationId,
            userId: schemaCheck.manualApprovalUserId,
          })
        : null;
    },
    approvalComment(schemaCheck) {
      return schemaCheck.isManuallyApproved ? schemaCheck.manualApprovalComment : null;
    },
    contractChecks(schemaCheck, _, { injector }) {
      return injector.get(ContractsManager).getContractsChecksForSchemaCheck(schemaCheck);
    },
    previousSchemaSDL(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getPreviousSchemaSDL(schemaCheck);
    },
    conditionalBreakingChangeMetadata(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getConditionalBreakingChangeMetadata(schemaCheck);
    },
  },
  FailedSchemaCheck: {
    schemaVersion(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
    },
    safeSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
    },
    breakingSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getBreakingSchemaChanges(schemaCheck);
    },
    compositionErrors(schemaCheck) {
      return schemaCheck.schemaCompositionErrors;
    },
    hasSchemaCompositionErrors(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaCompositionErrors(schemaCheck);
    },
    hasSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaChanges(schemaCheck);
    },
    hasUnapprovedBreakingChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasUnapprovedBreakingChanges(schemaCheck);
    },
    webUrl(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getSchemaCheckWebUrl({
        schemaCheckId: schemaCheck.id,
        targetId: schemaCheck.targetId,
      });
    },
    async canBeApproved(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getFailedSchemaCheckCanBeApproved(schemaCheck);
    },
    async canBeApprovedByViewer(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getFailedSchemaCheckCanBeApprovedByViewer(schemaCheck);
    },
    contractChecks(schemaCheck, _, { injector }) {
      return injector.get(ContractsManager).getContractsChecksForSchemaCheck(schemaCheck);
    },
    previousSchemaSDL(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getPreviousSchemaSDL(schemaCheck);
    },
    conditionalBreakingChangeMetadata(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getConditionalBreakingChangeMetadata(schemaCheck);
    },
  },
  BreakingChangeMetadataTarget: {
    target(record, _, { injector }) {
      return injector
        .get(TargetManager)
        .getTargetById({ targetId: record.id })
        .catch(() => null);
    },
  },
  SchemaPolicyWarningConnection: createDummyConnection(warning => ({
    ...warning,
    start: {
      column: warning.column,
      line: warning.line,
    },
    end:
      warning.endColumn && warning.endLine
        ? {
            column: warning.endColumn,
            line: warning.endLine,
          }
        : null,
  })),
  Contract: {
    target(contract, _, context) {
      return context.injector.get(TargetManager).getTargetById({
        targetId: contract.targetId,
      });
    },
    viewerCanDisableContract(contract, _, context) {
      return context.injector
        .get(ContractsManager)
        .getViewerCanDisableContractForContract(contract);
    },
  },
  ContractCheck: {
    contractVersion(contractCheck, _, context) {
      return context.injector
        .get(ContractsManager)
        .getContractVersionForContractCheck(contractCheck);
    },
    compositeSchemaSDL: contractCheck => contractCheck.compositeSchemaSdl,
    supergraphSDL: contractCheck => contractCheck.supergraphSdl,
    hasSchemaCompositionErrors(contractCheck, _, { injector }) {
      return injector
        .get(ContractsManager)
        .getHasSchemaCompositionErrorsForContractCheck(contractCheck);
    },
    hasUnapprovedBreakingChanges(contractCheck, _, { injector }) {
      return injector
        .get(ContractsManager)
        .getHasUnapprovedBreakingChangesForContractCheck(contractCheck);
    },
    hasSchemaChanges(contractCheck, _, { injector }) {
      return injector.get(ContractsManager).getHasSchemaChangesForContractCheck(contractCheck);
    },
  },
  ContractVersion: {
    isComposable(contractVersion) {
      return contractVersion.schemaCompositionErrors === null;
    },
    hasSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getHasSchemaChangesForContractVersion(contractVersion);
    },
    breakingSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getBreakingChangesForContractVersion(contractVersion);
    },
    safeSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getSafeChangesForContractVersion(contractVersion);
    },
    compositeSchemaSDL: contractVersion => contractVersion.compositeSchemaSdl,
    supergraphSDL: contractVersion => contractVersion.supergraphSdl,
    previousContractVersion: (contractVersion, _, context) =>
      context.injector
        .get(ContractsManager)
        .getPreviousContractVersionForContractVersion(contractVersion),
    previousDiffableContractVersion: (contractVersion, _, context) =>
      context.injector
        .get(ContractsManager)
        .getDiffableContractVersionForContractVersion(contractVersion),
    isFirstComposableVersion: (contractVersion, _, context) =>
      context.injector
        .get(ContractsManager)
        .getIsFirstComposableVersionForContractVersion(contractVersion),
  },
};

function stringifyDefaultValue(value: unknown): string | null {
  if (typeof value !== 'undefined') {
    return stringify(value);
  }
  return null;
}
