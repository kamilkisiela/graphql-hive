import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const targets: NonNullable<QueryResolvers['targets']> = async (
  _,
  { selector },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const [organization, project] = await Promise.all([
    translator.translateOrganizationId(selector),
    translator.translateProjectId(selector),
  ]);

  return injector.get(TargetManager).getTargets({
    organization,
    project,
  });
};
