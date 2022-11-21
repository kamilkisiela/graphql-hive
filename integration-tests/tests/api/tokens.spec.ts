import { ProjectType } from '@app/gql/graphql';
import { createOrganization, createProject, createToken, readTokenInfo, deleteTokens } from '../../testkit/flow';
import { authenticate } from '../../testkit/auth';

test('deleting a token should clear the cache', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  // member should not have access to target:registry:write
  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();
  const secret = tokenResult.body.data?.createToken.ok?.secret;
  const createdToken = tokenResult.body.data?.createToken.ok?.createdToken;

  expect(secret).toBeDefined();

  let tokenInfoResult = await readTokenInfo(secret!);
  expect(tokenInfoResult.body.errors).not.toBeDefined();

  if (tokenInfoResult.body.data?.tokenInfo.__typename === 'TokenNotFoundError' || !createdToken) {
    throw new Error('Token not found');
  }

  const tokenInfo = tokenInfoResult.body.data?.tokenInfo;
  // organization
  expect(tokenInfo?.hasOrganizationRead).toBe(true);
  expect(tokenInfo?.hasOrganizationDelete).toBe(false);
  expect(tokenInfo?.hasOrganizationIntegrations).toBe(false);
  expect(tokenInfo?.hasOrganizationMembers).toBe(false);
  expect(tokenInfo?.hasOrganizationSettings).toBe(false);
  // project
  expect(tokenInfo?.hasProjectRead).toBe(true);
  expect(tokenInfo?.hasProjectDelete).toBe(false);
  expect(tokenInfo?.hasProjectAlerts).toBe(false);
  expect(tokenInfo?.hasProjectOperationsStoreRead).toBe(false);
  expect(tokenInfo?.hasProjectOperationsStoreWrite).toBe(false);
  expect(tokenInfo?.hasProjectSettings).toBe(false);
  // target
  expect(tokenInfo?.hasTargetRead).toBe(true);
  expect(tokenInfo?.hasTargetDelete).toBe(false);
  expect(tokenInfo?.hasTargetSettings).toBe(false);
  expect(tokenInfo?.hasTargetRegistryRead).toBe(false);
  expect(tokenInfo?.hasTargetRegistryWrite).toBe(false);
  expect(tokenInfo?.hasTargetTokensRead).toBe(false);
  expect(tokenInfo?.hasTargetTokensWrite).toBe(false);

  // test invalidation
  await deleteTokens(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      tokens: [createdToken.id],
    },
    owner_access_token
  );

  tokenInfoResult = await readTokenInfo(secret!);
  expect(tokenInfoResult.body.errors).toHaveLength(1);
});
