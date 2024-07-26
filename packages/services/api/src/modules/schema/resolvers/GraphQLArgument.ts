import { stringifyDefaultValue, usage } from '../utils';
import type { GraphQlArgumentResolvers } from './../../../__generated__/types.next';

export const GraphQLArgument: GraphQlArgumentResolvers = {
  name: a => a.entity.name,
  description: a => a.entity.description ?? null,
  type: a => a.entity.type,
  defaultValue: a => stringifyDefaultValue(a.entity.defaultValue),
  deprecationReason: a => a.entity.deprecationReason ?? null,
  isDeprecated: a => typeof a.entity.deprecationReason === 'string',
  usage,
};
