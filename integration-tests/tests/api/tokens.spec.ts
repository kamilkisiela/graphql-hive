import { ProjectType } from '@app/gql/graphql';
import { initSeed } from '../../testkit/seed';

test.concurrent('deleting a token should clear the cache', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember, createProject } = await createOrg();
  await inviteAndJoinMember();
  const { createToken, removeTokens } = await createProject(ProjectType.Single);
  const { secret, token: createdToken, fetchTokenInfo } = await createToken([], [], []);

  expect(secret).toBeDefined();

  const tokenInfo = await fetchTokenInfo();

  if (tokenInfo.__typename === 'TokenNotFoundError' || !createdToken) {
    throw new Error('Token not found');
  }

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

  await removeTokens([createdToken.id]);
  await expect(fetchTokenInfo()).rejects.toThrow();
});
