import { TargetManager } from '../../../target/providers/target-manager';
import { SchemaManager } from '../../providers/schema-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const latestVersion: NonNullable<QueryResolvers['latestVersion']> = async (
  _,
  __,
  { injector },
) => {
  const target = await injector.get(TargetManager).getTargetFromToken();

  return injector.get(SchemaManager).getMaybeLatestVersion({
    organization: target.orgId,
    project: target.projectId,
    target: target.id,
  });
};
