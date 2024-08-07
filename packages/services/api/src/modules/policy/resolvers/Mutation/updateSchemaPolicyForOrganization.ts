import { TRPCClientError } from '@trpc/client';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { SchemaPolicyApiProvider } from '../../providers/schema-policy-api.provider';
import { SchemaPolicyProvider } from '../../providers/schema-policy.provider';
import { formatTRPCErrors, policyInputToConfigObject } from '../../utils';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateSchemaPolicyForOrganization: NonNullable<
  MutationResolvers['updateSchemaPolicyForOrganization']
> = async (_, { selector, policy, allowOverrides }, { injector }) => {
  try {
    const organization = await injector.get(IdTranslator).translateOrganizationId(selector);
    const config = policyInputToConfigObject(policy);
    await injector.get(SchemaPolicyApiProvider).validateConfig({ config });
    const updatedPolicy = await injector
      .get(SchemaPolicyProvider)
      .setOrganizationPolicy({ organization }, config, allowOverrides);

    return {
      ok: {
        updatedPolicy,
        organization: await injector.get(OrganizationManager).getOrganization({ organization }),
      },
    };
  } catch (e) {
    if (e instanceof TRPCClientError) {
      return formatTRPCErrors(e);
    }

    return {
      error: {
        __typename: 'UpdateSchemaPolicyResultError',
        message: (e as Error).message,
      },
    };
  }
};
