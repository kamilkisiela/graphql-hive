import { parseDateRangeInput } from '../../../../shared/helpers';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OperationsManager } from '../../providers/operations-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const fieldStats: NonNullable<QueryResolvers['fieldStats']> = async (
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

  return injector.get(OperationsManager).readFieldStats({
    organization,
    project,
    target,
    type: selector.type,
    field: selector.field,
    argument: selector.argument ?? undefined,
    period: parseDateRangeInput(selector.period),
  });
};
