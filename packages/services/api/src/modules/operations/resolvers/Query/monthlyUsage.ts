import { IdTranslator } from '../../../shared/providers/id-translator';
import { OperationsManager } from '../../providers/operations-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const monthlyUsage: NonNullable<QueryResolvers['monthlyUsage']> = async (
  _,
  { selector },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const organization = await translator.translateOrganizationId(selector);

  return injector.get(OperationsManager).readMonthlyUsage({
    organization,
  });
};
