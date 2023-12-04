import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { initSeed } from './seed';

export async function prepareProject(projectType: ProjectType) {
  const { createOrg } = await initSeed().createOwner();
  const { organization, createProject, setFeatureFlag, setOrganizationSchemaPolicy } =
    await createOrg();
  const { project, createToken, target, targets, setProjectSchemaPolicy, setNativeFederation } =
    await createProject(projectType);

  // Create a token with write rights
  const {
    secret: readwriteToken,
    createCdnAccess,
    fetchMetadataFromCDN,
  } = await createToken({
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

  // Create CDN token
  const { secretAccessToken: cdnToken, cdnUrl } = await createCdnAccess();

  return {
    organization,
    project,
    targets,
    target,
    fetchVersions,
    policy: {
      setOrganizationSchemaPolicy,
      setProjectSchemaPolicy,
    },
    tokens: {
      registry: {
        readwrite: readwriteToken,
        readonly: readonlyToken,
      },
    },
    cdn: {
      token: cdnToken,
      url: cdnUrl,
      fetchMetadata() {
        return fetchMetadataFromCDN();
      },
    },
    setFeatureFlag,
    setNativeFederation,
  };
}
