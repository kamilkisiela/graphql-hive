import { parseDateRangeInput } from '../../../../shared/helpers';
import { IdTranslator } from '../../../shared/providers/id-translator';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const schemaCoordinateStats: NonNullable<QueryResolvers['schemaCoordinateStats']> = async (
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

  return {
    period: parseDateRangeInput(selector.period),
    organization,
    project,
    target,
    schemaCoordinate: selector.schemaCoordinate,
  };
};
