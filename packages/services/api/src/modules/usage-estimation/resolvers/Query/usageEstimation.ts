import { GraphQLError } from 'graphql';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { UsageEstimationProvider } from '../../providers/usage-estimation.provider';
import {
  OrganizationAccessScope,
  type QueryResolvers,
} from './../../../../__generated__/types.next';

export const usageEstimation: NonNullable<QueryResolvers['usageEstimation']> = async (
  _parent,
  args,
  { injector },
) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId({
    organization: args.input.organization,
  });

  await injector.get(AuthManager).ensureOrganizationAccess({
    organization: organizationId,
    scope: OrganizationAccessScope.SETTINGS,
  });

  const result = await injector.get(UsageEstimationProvider).estimateOperationsForOrganization({
    organizationId: organizationId,
    month: args.input.month,
    year: args.input.year,
  });

  if (!result && result !== 0) {
    throw new GraphQLError(`Failed to estimate usage, please try again later.`);
  }

  return {
    operations: result,
  };
};
