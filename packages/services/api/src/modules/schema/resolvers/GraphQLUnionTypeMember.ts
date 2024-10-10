import { usage } from '../utils';
import type { GraphQlUnionTypeMemberResolvers } from './../../../__generated__/types.next';

export const GraphQLUnionTypeMember: GraphQlUnionTypeMemberResolvers = {
  name: m => m.entity.name,
  usage,
  supergraphMetadata: m =>
    m.supergraph ? { ownedByServiceNames: m.supergraph.ownedByServiceNames } : null,
};
