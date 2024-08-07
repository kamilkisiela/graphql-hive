import { SchemaPolicyApiProvider } from '../../providers/schema-policy-api.provider';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const schemaPolicyRules: NonNullable<QueryResolvers['schemaPolicyRules']> = async (
  _,
  _args,
  { injector },
) => injector.get(SchemaPolicyApiProvider).listAvailableRules();
