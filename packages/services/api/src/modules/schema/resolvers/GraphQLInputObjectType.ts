import { Kind } from 'graphql';
import { __isTypeOf, usage } from '../utils';
import type { GraphQlInputObjectTypeResolvers } from './../../../__generated__/types.next';

export const GraphQLInputObjectType: GraphQlInputObjectTypeResolvers = {
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
};
