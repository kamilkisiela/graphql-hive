import { ProjectType, TargetAccessScope, RegistryModel } from '@app/gql/graphql';
import { initSeed } from './seed';

export async function prepareProject(
  projectType: ProjectType,
  model: RegistryModel = RegistryModel.Modern,
) {
  const { createOrg } = await initSeed().createOwner();
  const { organization, createProject } = await createOrg();
  const { project, createToken, target, targets } = await createProject(projectType, {
    useLegacyRegistryModels: model === RegistryModel.Legacy,
  });

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
