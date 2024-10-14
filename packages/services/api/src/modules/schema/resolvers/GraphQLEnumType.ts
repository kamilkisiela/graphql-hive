import { Kind } from 'graphql';
import { __isTypeOf, usage } from '../utils';
import type { GraphQlEnumTypeResolvers } from './../../../__generated__/types.next';

export const GraphQLEnumType: GraphQlEnumTypeResolvers = {
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
};
