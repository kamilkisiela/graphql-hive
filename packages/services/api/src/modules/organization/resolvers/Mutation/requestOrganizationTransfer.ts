import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const requestOrganizationTransfer: NonNullable<
  MutationResolvers['requestOrganizationTransfer']
> = async (_, { input }, { injector }) => {
  const organization = await injector.get(IdTranslator).translateOrganizationId(input);
  return injector.get(OrganizationManager).requestOwnershipTransfer({
    organization,
    user: input.user,
  });
};
