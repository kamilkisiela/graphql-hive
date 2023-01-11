import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { initSeed } from './seed';

export async function prepareProject(projectType: ProjectType) {
  const { createOrg } = await initSeed().createOwner();
  const { organization, createProject } = await createOrg();
  const { project, createToken, target, targets } = await createProject(projectType);

  // Create a token with write rights
  const { secret } = await createToken({
    organizationScopes: [],
    projectScopes: [],
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
  });

  return {
    organization,
    project,
    targets,
    target,
    tokens: {
      registry: secret,
    },
  };
}
