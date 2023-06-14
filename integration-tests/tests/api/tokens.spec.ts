import { waitFor } from 'testkit/flow';
import { ProjectType } from '@app/gql/graphql';
import { initSeed } from '../../testkit/seed';

test.concurrent('deleting a token should clear the cache', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember, createProject } = await createOrg();
  await inviteAndJoinMember();
  const { createToken, removeTokens } = await createProject(ProjectType.Single);
  const {
    secret,
    token: createdToken,
    fetchTokenInfo,
  } = await createToken({ targetScopes: [], projectScopes: [], organizationScopes: [] });

  expect(secret).toBeDefined();

  const tokenInfo = await fetchTokenInfo();

  if (tokenInfo.__typename === 'TokenNotFoundError' || !createdToken) {
    throw new Error('Token not found');
  }

  const expectedResult = {
    // organization
    hasOrganizationRead: true,
    hasOrganizationDelete: false,
    hasOrganizationIntegrations: false,
    hasOrganizationMembers: false,
    hasOrganizationSettings: false,
    // project
    hasProjectRead: true,
    hasProjectDelete: false,
    hasProjectAlerts: false,
    hasProjectOperationsStoreRead: false,
    hasProjectOperationsStoreWrite: false,
    hasProjectSettings: false,
    // target
    hasTargetRead: true,
    hasTargetDelete: false,
    hasTargetSettings: false,
    hasTargetRegistryRead: false,
    hasTargetRegistryWrite: false,
    hasTargetTokensRead: false,
    hasTargetTokensWrite: false,
  };

  expect(tokenInfo).toEqual(expect.objectContaining(expectedResult));
  await removeTokens([createdToken.id]);
  // packages/services/server/src/graphql-handler.ts: Query.tokenInfo is cached for 5 seconds.
  // Fetch the token info again to make sure it's cached
  await expect(fetchTokenInfo()).resolves.toEqual(expect.objectContaining(expectedResult));
  // To make sure the cache is cleared, we need to wait for at least 5 seconds
  await waitFor(5500);
  await expect(fetchTokenInfo()).rejects.toThrow();
});
