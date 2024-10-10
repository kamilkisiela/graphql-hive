import {
  GraphQLEnumTypeMapper,
  GraphQLInputObjectTypeMapper,
  GraphQLInterfaceTypeMapper,
  GraphQLObjectTypeMapper,
  GraphQLScalarTypeMapper,
  GraphQLUnionTypeMapper,
} from '../module.graphql.mappers';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  Kind,
} from 'graphql';
import { OperationsManager } from '../../operations/providers/operations-manager';
import { withUsedByClients } from '../utils';
import type { SchemaExplorerResolvers } from './../../../__generated__/types.next';

export const SchemaExplorer: SchemaExplorerResolvers = {
  type: async (source, { name }, { injector }) => {
    const entity = source.schema.getType(name);
    const operationsManager = injector.get(OperationsManager);

    if (!entity) {
      return null;
    }

    const { supergraph } = source;
    const usage = () =>
      injector
        .get(OperationsManager)
        .countCoordinatesOfType({
          typename: entity.name,
          organization: source.usage.organization,
          project: source.usage.project,
          target: source.usage.target,
          period: source.usage.period,
        })
        .then(usage =>
          withUsedByClients(usage, {
            selector: source.usage,
            period: source.usage.period,
            operationsManager,
            typename: entity.name,
          }),
        );

    if (isObjectType(entity)) {
      return {
        entity: transformGraphQLObjectType(entity),
        usage,
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                null,
            }
          : null,
      } satisfies GraphQLObjectTypeMapper;
    }
    if (isInterfaceType(entity)) {
      return {
        entity: transformGraphQLInterfaceType(entity),
        usage,
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                null,
            }
          : null,
      } satisfies GraphQLInterfaceTypeMapper;
    }
    if (isEnumType(entity)) {
      return {
        entity: transformGraphQLEnumType(entity),
        usage,
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              getEnumValueOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                null,
            }
          : null,
      } satisfies GraphQLEnumTypeMapper;
    }
    if (isUnionType(entity)) {
      return {
        entity: transformGraphQLUnionType(entity),
        usage,
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              getUnionMemberOwnedByServices: (memberName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(memberName) ?? null,
            }
          : null,
      } satisfies GraphQLUnionTypeMapper;
    }
    if (isInputObjectType(entity)) {
      return {
        entity: transformGraphQLInputObjectType(entity),
        usage,
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              getInputFieldOwnedByServices: (inputFieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${entity.name}.${inputFieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLInputObjectTypeMapper;
    }
    if (isScalarType(entity)) {
      return {
        entity: transformGraphQLScalarType(entity),
        usage,
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
            }
          : null,
      } satisfies GraphQLScalarTypeMapper;
    }

    throw new Error('Illegal state: unknown type kind');
  },
  types: ({ schema, usage, supergraph }, _, { injector }) => {
    const types: Array<
      | GraphQLObjectTypeMapper
      | GraphQLInterfaceTypeMapper
      | GraphQLUnionTypeMapper
      | GraphQLEnumTypeMapper
      | GraphQLInputObjectTypeMapper
      | GraphQLScalarTypeMapper
    > = [];
    const typeMap = schema.getTypeMap();
    const operationsManager = injector.get(OperationsManager);

    async function getStats(typename: string) {
      const stats = await operationsManager.countCoordinatesOfTarget({
        target: usage.target,
        organization: usage.organization,
        project: usage.project,
        period: usage.period,
      });

      return withUsedByClients(stats, {
        selector: usage,
        period: usage.period,
        operationsManager,
        typename,
      });
    }

    for (const typename in typeMap) {
      if (typename.startsWith('__')) {
        continue;
      }

      const entity = typeMap[typename];

      if (isObjectType(entity)) {
        types.push({
          entity: transformGraphQLObjectType(entity),
          usage() {
            return getStats(entity.name);
          },
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                getFieldOwnedByServices: (fieldName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(`${typename}.${fieldName}`) ??
                  null,
              }
            : null,
        });
      } else if (isInterfaceType(entity)) {
        types.push({
          entity: transformGraphQLInterfaceType(entity),
          usage() {
            return getStats(entity.name);
          },
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                getFieldOwnedByServices: (fieldName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(`${typename}.${fieldName}`) ??
                  null,
              }
            : null,
        });
      } else if (isEnumType(entity)) {
        types.push({
          entity: transformGraphQLEnumType(entity),
          usage() {
            return getStats(entity.name);
          },
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                getEnumValueOwnedByServices: (fieldName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(`${typename}.${fieldName}`) ??
                  null,
              }
            : null,
        });
      } else if (isUnionType(entity)) {
        types.push({
          entity: transformGraphQLUnionType(entity),
          usage() {
            return getStats(entity.name);
          },
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                getUnionMemberOwnedByServices: (memberName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(memberName) ?? null,
              }
            : null,
        });
      } else if (isInputObjectType(entity)) {
        types.push({
          entity: transformGraphQLInputObjectType(entity),
          usage() {
            return getStats(entity.name);
          },
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                getInputFieldOwnedByServices: (inputFieldName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(
                    `${typename}.${inputFieldName}`,
                  ) ?? null,
              }
            : null,
        });
      } else if (isScalarType(entity)) {
        types.push({
          entity: transformGraphQLScalarType(entity),
          usage() {
            return getStats(entity.name);
          },
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              }
            : null,
        });
      }
    }

    types.sort((a, b) => a.entity.name.localeCompare(b.entity.name));

    return types;
  },
  query: async ({ schema, supergraph, usage }, _, { injector }) => {
    const entity = schema.getQueryType();

    if (!entity) {
      return null;
    }

    const operationsManager = injector.get(OperationsManager);

    return {
      entity: transformGraphQLObjectType(entity),
      usage() {
        return operationsManager
          .countCoordinatesOfType({
            typename: entity.name,
            organization: usage.organization,
            project: usage.project,
            target: usage.target,
            period: usage.period,
          })
          .then(stats =>
            withUsedByClients(stats, {
              selector: usage,
              period: usage.period,
              operationsManager,
              typename: entity.name,
            }),
          );
      },
      supergraph: supergraph
        ? {
            ownedByServiceNames:
              supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
            getFieldOwnedByServices: (fieldName: string) =>
              supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
              null,
          }
        : null,
    };
  },
  mutation: async ({ schema, supergraph, usage }, _, { injector }) => {
    const entity = schema.getMutationType();

    if (!entity) {
      return null;
    }

    const operationsManager = injector.get(OperationsManager);

    return {
      entity: transformGraphQLObjectType(entity),
      usage() {
        return operationsManager
          .countCoordinatesOfType({
            typename: entity.name,
            organization: usage.organization,
            project: usage.project,
            target: usage.target,
            period: usage.period,
          })
          .then(stats =>
            withUsedByClients(stats, {
              selector: usage,
              period: usage.period,
              operationsManager,
              typename: entity.name,
            }),
          );
      },
      supergraph: supergraph
        ? {
            ownedByServiceNames:
              supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
            getFieldOwnedByServices: (fieldName: string) =>
              supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
              null,
          }
        : null,
    };
  },
  subscription: async ({ schema, supergraph, usage }, _, { injector }) => {
    const entity = schema.getSubscriptionType();

    if (!entity) {
      return null;
    }

    const operationsManager = injector.get(OperationsManager);

    return {
      entity: transformGraphQLObjectType(entity),
      usage() {
        return operationsManager
          .countCoordinatesOfType({
            typename: entity.name,
            organization: usage.organization,
            project: usage.project,
            target: usage.target,
            period: usage.period,
          })
          .then(stats =>
            withUsedByClients(stats, {
              selector: usage,
              period: usage.period,
              operationsManager,
              typename: entity.name,
            }),
          );
      },
      supergraph: supergraph
        ? {
            ownedByServiceNames:
              supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
            getFieldOwnedByServices: (fieldName: string) =>
              supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
              null,
          }
        : null,
    };
  },
};

function transformGraphQLObjectType(entity: GraphQLObjectType): GraphQLObjectTypeMapper['entity'] {
  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    interfaces: entity.getInterfaces().map(iface => iface.name),
    fields: Object.values(entity.getFields()).map(field => ({
      name: field.name,
      description: field.description,
      deprecationReason: field.deprecationReason,
      type: field.type.toString(),
      args: field.args.map(arg => ({
        name: arg.name,
        description: arg.description,
        defaultValue: arg.defaultValue,
        type: arg.type.toString(),
        deprecationReason: arg.deprecationReason,
      })),
    })),
  };
}

function transformGraphQLInterfaceType(
  entity: GraphQLInterfaceType,
): GraphQLInterfaceTypeMapper['entity'] {
  return {
    kind: Kind.INTERFACE_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    interfaces: entity.getInterfaces().map(iface => iface.name),
    fields: Object.values(entity.getFields()).map(field => ({
      name: field.name,
      description: field.description,
      deprecationReason: field.deprecationReason,
      type: field.type.toString(),
      args: field.args.map(arg => ({
        name: arg.name,
        description: arg.description,
        defaultValue: arg.defaultValue,
        type: arg.type.toString(),
        deprecationReason: arg.deprecationReason,
      })),
    })),
  };
}

function transformGraphQLEnumType(entity: GraphQLEnumType): GraphQLEnumTypeMapper['entity'] {
  return {
    kind: Kind.ENUM_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    values: entity.getValues().map(value => ({
      name: value.name,
      description: value.description,
      deprecationReason: value.deprecationReason,
    })),
  };
}

function transformGraphQLUnionType(entity: GraphQLUnionType): GraphQLUnionTypeMapper['entity'] {
  return {
    kind: Kind.UNION_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    members: entity.getTypes().map(type => ({
      name: type.name,
    })),
  };
}

function transformGraphQLInputObjectType(
  entity: GraphQLInputObjectType,
): GraphQLInputObjectTypeMapper['entity'] {
  return {
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    fields: Object.values(entity.getFields()).map(field => ({
      name: field.name,
      description: field.description,
      deprecationReason: field.deprecationReason,
      defaultValue: field.defaultValue,
      type: field.type.toString(),
    })),
  };
}

function transformGraphQLScalarType(entity: GraphQLScalarType): GraphQLScalarTypeMapper['entity'] {
  return {
    kind: Kind.SCALAR_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
  };
}
