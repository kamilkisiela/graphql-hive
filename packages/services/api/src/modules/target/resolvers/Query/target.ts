import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const target: NonNullable<QueryResolvers['target']> = async (
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

  return injector.get(TargetManager).getTarget({
    organization,
    target,
    project,
  });
};
