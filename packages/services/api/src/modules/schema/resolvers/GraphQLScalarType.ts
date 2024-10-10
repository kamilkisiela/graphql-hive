import { Kind } from 'graphql';
import { __isTypeOf, usage } from '../utils';
import type { GraphQlScalarTypeResolvers } from './../../../__generated__/types.next';

export const GraphQLScalarType: GraphQlScalarTypeResolvers = {
  __isTypeOf: __isTypeOf(Kind.SCALAR_TYPE_DEFINITION),
  name: t => t.entity.name,
  description: t => t.entity.description ?? null,
  usage,
  supergraphMetadata: t =>
    t.supergraph ? { ownedByServiceNames: t.supergraph.ownedByServiceNames } : null,
};
