import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { ProjectManager } from '../../../project/providers/project-manager';
import { TargetManager } from '../../../target/providers/target-manager';
import { SchemaPublisher } from '../../providers/schema-publisher';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const schemaCheck: NonNullable<MutationResolvers['schemaCheck']> = async (
  _,
  { input },
  { injector },
) => {
  const [organization, project, target] = await Promise.all([
    injector.get(OrganizationManager).getOrganizationIdByToken(),
    injector.get(ProjectManager).getProjectIdByToken(),
    injector.get(TargetManager).getTargetIdByToken(),
  ]);

  const result = await injector.get(SchemaPublisher).check({
    ...input,
    service: input.service?.toLowerCase(),
    organization,
    project,
    target,
  });

  if ('changes' in result && result.changes) {
    return {
      ...result,
      changes: result.changes,
      errors:
        result.errors?.map(error => ({
          ...error,
          path: 'path' in error ? error.path?.split('.') : null,
        })) ?? [],
    };
  }

  return result;
};
