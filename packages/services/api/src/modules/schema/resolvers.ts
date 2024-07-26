import type {
  GraphQLEnumTypeMapper,
  GraphQLInputObjectTypeMapper,
  GraphQLInterfaceTypeMapper,
  GraphQLNamedTypeMapper,
  GraphQLObjectTypeMapper,
  GraphQLScalarTypeMapper,
  GraphQLUnionTypeMapper,
  SchemaCoordinateUsageForUnusedExplorer,
  SchemaCoordinateUsageMapper,
  WithGraphQLParentInfo,
  WithSchemaCoordinatesUsage,
} from './module.graphql.mappers';
import stringify from 'fast-json-stable-stringify';
import { ConstDirectiveNode, DEFAULT_DEPRECATION_REASON, DocumentNode, Kind, print } from 'graphql';
import { createDummyConnection } from '../../shared/schema';
import { TargetManager } from '../target/providers/target-manager';
import type { SchemaModule } from './__generated__/types';
import { SuperGraphInformation } from './lib/federation-super-graph';
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
  UnusedSchemaExplorer: {
    types({ sdl, supergraph, usage }) {
      const unused = () =>
        ({
          isUsed: false,
          usedCoordinates: usage.usedCoordinates,
          period: usage.period,
          organization: usage.organization,
          project: usage.project,
          target: usage.target,
        }) as const;

      return buildGraphQLTypesFromSDL(sdl, unused, supergraph).sort((a, b) =>
        a.entity.name.localeCompare(b.entity.name),
      );
    },
  },
  GraphQLObjectType: {
    __isTypeOf: __isTypeOf(Kind.OBJECT_TYPE_DEFINITION),
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
          ? { ownedByServiceNames: t.supergraph.getFieldOwnedByServices(f.name) }
          : null,
      })),
    interfaces: t => t.entity.interfaces,
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLInterfaceType: {
    __isTypeOf: __isTypeOf(Kind.INTERFACE_TYPE_DEFINITION),
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
          ? { ownedByServiceNames: t.supergraph.getFieldOwnedByServices(f.name) }
          : null,
      })),
    interfaces: t => t.entity.interfaces,
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
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

function deprecationReasonFromDirectives(directives: readonly ConstDirectiveNode[] | undefined) {
  if (!directives) {
    return null;
  }

  const deprecatedDirective = directives.find(d => d.name.value === 'deprecated');

  if (!deprecatedDirective) {
    return null;
  }

  const reasonArgument = deprecatedDirective.arguments?.find(a => a.name.value === 'reason');

  if (!reasonArgument) {
    return DEFAULT_DEPRECATION_REASON;
  }

  if (reasonArgument.value.kind !== 'StringValue') {
    throw new Error('Expected @deprecated(reason:) to be StringValue');
  }

  return reasonArgument.value.value;
}

function buildGraphQLTypesFromSDL(
  sdl: DocumentNode,
  getStats: (
    typeName: string,
  ) => ReturnType<
    | GraphQLObjectTypeMapper['usage']
    | GraphQLInterfaceTypeMapper['usage']
    | GraphQLUnionTypeMapper['usage']
    | GraphQLEnumTypeMapper['usage']
    | GraphQLInputObjectTypeMapper['usage']
    | GraphQLScalarTypeMapper['usage']
  >,
  supergraph: SuperGraphInformation | null,
) {
  const types: Array<
    | GraphQLObjectTypeMapper
    | GraphQLInterfaceTypeMapper
    | GraphQLUnionTypeMapper
    | GraphQLEnumTypeMapper
    | GraphQLInputObjectTypeMapper
    | GraphQLScalarTypeMapper
  > = [];

  for (const typeDefinition of sdl.definitions) {
    if (typeDefinition.kind === Kind.OBJECT_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.OBJECT_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          interfaces: typeDefinition.interfaces?.map(i => i.name.value) ?? [],
          fields:
            typeDefinition.fields?.map(f => ({
              name: f.name.value,
              description: f.description?.value,
              type: print(f.type),
              deprecationReason: deprecationReasonFromDirectives(f.directives),
              args:
                f.arguments?.map(a => ({
                  name: a.name.value,
                  description: a.description?.value,
                  deprecationReason: deprecationReasonFromDirectives(a.directives),
                  type: print(a.type),
                })) ?? [],
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${typeDefinition.name.value}.${fieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLObjectTypeMapper);
    } else if (typeDefinition.kind === Kind.INTERFACE_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.INTERFACE_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          interfaces: typeDefinition.interfaces?.map(i => i.name.value) ?? [],
          fields:
            typeDefinition.fields?.map(f => ({
              name: f.name.value,
              description: f.description?.value,
              deprecationReason: deprecationReasonFromDirectives(f.directives),
              type: print(f.type),
              args:
                f.arguments?.map(a => ({
                  name: a.name.value,
                  description: a.description?.value,
                  deprecationReason: deprecationReasonFromDirectives(a.directives),
                  type: print(a.type),
                })) ?? [],
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${typeDefinition.name.value}.${fieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLInterfaceTypeMapper);
    } else if (typeDefinition.kind === Kind.ENUM_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.ENUM_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          values:
            typeDefinition.values?.map(value => ({
              name: value.name.value,
              description: value.description?.value,
              deprecationReason: deprecationReasonFromDirectives(value.directives),
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getEnumValueOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${typeDefinition.name.value}.${fieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLEnumTypeMapper);
    } else if (typeDefinition.kind === Kind.UNION_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.UNION_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          members:
            typeDefinition.types?.map(t => ({
              name: t.name.value,
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getUnionMemberOwnedByServices: (memberName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(memberName) ?? null,
            }
          : null,
      } satisfies GraphQLUnionTypeMapper);
    } else if (typeDefinition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          fields:
            typeDefinition.fields?.map(f => ({
              name: f.name.value,
              defaultValue: f.defaultValue ? print(f.defaultValue) : undefined,
              description: f.description?.value,
              deprecationReason: deprecationReasonFromDirectives(f.directives),
              type: print(f.type),
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getInputFieldOwnedByServices: (inputFieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${typeDefinition.name.value}.${inputFieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLInputObjectTypeMapper);
    } else if (typeDefinition.kind === Kind.SCALAR_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.SCALAR_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
            }
          : null,
      } satisfies GraphQLScalarTypeMapper);
    }
  }

  return types;
}
