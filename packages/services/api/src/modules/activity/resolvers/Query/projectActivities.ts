import { IdTranslator } from '../../../shared/providers/id-translator';
import { ActivityManager } from '../../providers/activity-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const projectActivities: NonNullable<QueryResolvers['projectActivities']> = async (
  _,
  { selector },
  { injector },
) => {
  const [organization, project] = await Promise.all([
    injector.get(IdTranslator).translateOrganizationId(selector),
    injector.get(IdTranslator).translateProjectId(selector),
  ]);

  return injector.get(ActivityManager).getByProject({
    organization,
    project,
    limit: selector.limit,
  });
};
