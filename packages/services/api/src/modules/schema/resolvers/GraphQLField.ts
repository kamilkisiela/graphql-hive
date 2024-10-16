import { usage } from '../utils';
import type { GraphQlFieldResolvers } from './../../../__generated__/types.next';

export const GraphQLField: GraphQlFieldResolvers = {
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
};
