import { IdTranslator } from '../../../shared/providers/id-translator';
import { ActivityManager } from '../../providers/activity-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const targetActivities: NonNullable<QueryResolvers['targetActivities']> = async (
  _,
  { selector },
  { injector },
) => {
  const [organization, project, target] = await Promise.all([
    injector.get(IdTranslator).translateOrganizationId(selector),
    injector.get(IdTranslator).translateProjectId(selector),
    injector.get(IdTranslator).translateTargetId(selector),
  ]);

  return injector.get(ActivityManager).getByTarget({
    organization,
    project,
    target,
    limit: selector.limit,
  });
};
