import { Kind } from 'graphql';
import { __isTypeOf, usage } from '../utils';
import type { GraphQlInterfaceTypeResolvers } from './../../../__generated__/types.next';

export const GraphQLInterfaceType: GraphQlInterfaceTypeResolvers = {
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
};
