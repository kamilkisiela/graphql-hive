import { createHash } from 'node:crypto';
import stringify from 'fast-json-stable-stringify';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { ProjectManager } from '../../../project/providers/project-manager';
import { TargetManager } from '../../../target/providers/target-manager';
import { SchemaPublisher } from '../../providers/schema-publisher';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const schemaDelete: NonNullable<MutationResolvers['schemaDelete']> = async (
  _,
  { input },
  { injector, request },
) => {
  const [organization, project, target] = await Promise.all([
    injector.get(OrganizationManager).getOrganizationIdByToken(),
    injector.get(ProjectManager).getProjectIdByToken(),
    injector.get(TargetManager).getTargetFromToken(),
  ]);

  const token = injector.get(AuthManager).ensureApiToken();

  const checksum = createHash('md5')
    .update(
      stringify({
        ...input,
        serviceName: input.serviceName.toLowerCase(),
      }),
    )
    .update(token)
    .digest('base64');

  const result = await injector.get(SchemaPublisher).delete(
    {
      dryRun: input.dryRun,
      serviceName: input.serviceName.toLowerCase(),
      organization,
      project,
      target,
      checksum,
    },
    request.signal,
  );

  return {
    ...result,
    changes: result.changes,
    errors: result.errors?.map(error => ({
      ...error,
      path: 'path' in error ? error.path?.split('.') : null,
    })),
  };
};
