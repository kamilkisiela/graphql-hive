import { SchemaPolicyProvider } from '../providers/schema-policy.provider';
import type { OrganizationResolvers } from './../../../__generated__/types.next';

export const Organization: Pick<OrganizationResolvers, 'schemaPolicy' | '__isTypeOf'> = {
  schemaPolicy: async (org, _, { injector }) =>
    injector.get(SchemaPolicyProvider).getOrganizationPolicy({
      organization: org.id,
    }),
};
