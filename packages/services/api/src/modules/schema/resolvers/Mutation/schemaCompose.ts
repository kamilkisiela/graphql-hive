import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { ProjectManager } from '../../../project/providers/project-manager';
import { TargetManager } from '../../../target/providers/target-manager';
import { SchemaManager } from '../../providers/schema-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const schemaCompose: NonNullable<MutationResolvers['schemaCompose']> = async (
  _,
  { input },
  { injector },
) => {
  const [organization, project, target] = await Promise.all([
    injector.get(OrganizationManager).getOrganizationIdByToken(),
    injector.get(ProjectManager).getProjectIdByToken(),
    injector.get(TargetManager).getTargetIdByToken(),
  ]);

  const result = await injector.get(SchemaManager).compose({
    onlyComposable: input.useLatestComposableVersion === true,
    services: input.services,
    organization,
    project,
    target,
  });

  if (result.kind === 'error') {
    return {
      __typename: 'SchemaComposeError',
      message: result.message,
    };
  }

  return {
    __typename: 'SchemaComposeSuccess',
    valid: 'supergraphSDL' in result && result.supergraphSDL !== null,
    compositionResult: {
      errors: result.errors,
      supergraphSdl: result.supergraphSDL,
    },
  };
};
