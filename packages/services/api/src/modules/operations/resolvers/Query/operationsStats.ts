import { parseDateRangeInput } from '../../../../shared/helpers';
import { IdTranslator } from '../../../shared/providers/id-translator';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const operationsStats: NonNullable<QueryResolvers['operationsStats']> = async (
  _,
  { selector },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const [organization, project, target] = await Promise.all([
    translator.translateOrganizationId(selector),
    translator.translateProjectId(selector),
    translator.translateTargetId(selector),
  ]);

  const operations = selector.operations ?? [];

  return {
    period: parseDateRangeInput(selector.period),
    organization,
    project,
    target,
    operations,
    clients:
      // TODO: figure out if the mapping should actually happen here :thinking:
      selector.clientNames?.map(clientName => (clientName === 'unknown' ? '' : clientName)) ?? [],
  };
};
