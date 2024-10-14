import { Kind } from 'graphql';
import { __isTypeOf, usage } from '../utils';
import type { GraphQlUnionTypeResolvers } from './../../../__generated__/types.next';

export const GraphQLUnionType: GraphQlUnionTypeResolvers = {
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
};
