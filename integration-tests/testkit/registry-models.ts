import { ProjectType, RegistryModel, TargetAccessScope } from '@app/gql/graphql';
import { initSeed } from './seed';

export async function prepareProject(
  projectType: ProjectType,
  model: RegistryModel = RegistryModel.Modern,
) {
  const { createOrg } = await initSeed().createOwner();
  const { organization, createProject, setFeatureFlag } = await createOrg();
  const { project, createToken, target, targets } = await createProject(projectType, {
    useLegacyRegistryModels: model === RegistryModel.Legacy,
  });

  // Create a token with write rights
  const { secret: readwriteToken } = await createToken({
    organizationScopes: [],
    projectScopes: [],
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
  });

  // Create a token with read-only rights
  const { secret: readonlyToken, fetchVersions } = await createToken({
    organizationScopes: [],
    projectScopes: [],
    targetScopes: [TargetAccessScope.RegistryRead],
  });

  return {
    organization,
    project,
    targets,
    target,
    fetchVersions,
    tokens: {
      registry: {
        readwrite: readwriteToken,
        readonly: readonlyToken,
      },
    },
    setFeatureFlag,
  };
}
