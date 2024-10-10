import { usage } from '../utils';
import type { GraphQlEnumValueResolvers } from './../../../__generated__/types.next';

export const GraphQLEnumValue: GraphQlEnumValueResolvers = {
  name: v => v.entity.name,
  description: v => v.entity.description ?? null,
  isDeprecated: v => typeof v.entity.deprecationReason === 'string',
  deprecationReason: v => v.entity.deprecationReason ?? null,
  usage,
  supergraphMetadata: v =>
    v.supergraph ? { ownedByServiceNames: v.supergraph.ownedByServiceNames } : null,
};
