import { stringifyDefaultValue, usage } from '../utils';
import type { GraphQlInputFieldResolvers } from './../../../__generated__/types.next';

export const GraphQLInputField: GraphQlInputFieldResolvers = {
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
};
