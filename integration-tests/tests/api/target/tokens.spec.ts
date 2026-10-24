import { readOrganizationInfo, readProjectInfo, readTargetInfo } from 'testkit/flow';
import { ProjectType } from 'testkit/gql/graphql';
import { initSeed } from '../../../testkit/seed';
import { getServiceHost } from '../../../testkit/utils';

test.concurrent(
  'setting no scopes equals to readonly for organization, project, target',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Single);

    // member should not have access to target:registry:write
    const token = await createTargetAccessToken({
      mode: 'noAccess',
    });
    const tokenInfo = await token.fetchTokenInfo();
    if (tokenInfo.__typename === 'TokenNotFoundError') {
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
  },
);

test.concurrent(
  'cannot set a scope on a token if user has no access to that scope',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, inviteAndJoinMember } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Single);
    const { memberToken } = await inviteAndJoinMember();

    // member should not have access to target:registry:write (as it's only a Viewer)
    const tokenResult = createTargetAccessToken({
      mode: 'readWrite',
      target,
      actorToken: memberToken,
    });

    await expect(tokenResult).rejects.toThrowError(
      'No access (reason: "Missing permission for performing \'targetAccessToken:modify\' on resource")',
    );
  },
);

test.concurrent(
  'setting target:registry:read should allow to read the organization, project, target data',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    const targetSlug = target.slug;
    const projectSlug = project.slug;
    const organizationSlug = organization.slug;

    // member should not have access to target:registry:write
    const token = await createTargetAccessToken({
      mode: 'readOnly',
    });
    const tokenInfo = await token.fetchTokenInfo();
    if (tokenInfo.__typename === 'TokenNotFoundError') {
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
    expect(tokenInfo?.hasTargetRegistryRead).toBe(true);
    expect(tokenInfo?.hasTargetRegistryWrite).toBe(false);
    expect(tokenInfo?.hasTargetTokensRead).toBe(false);
    expect(tokenInfo?.hasTargetTokensWrite).toBe(false);

    // read the organization, project, target data
    const [targetResult, projectResult, organizationResult] = await Promise.all([
      readTargetInfo({ targetSlug, projectSlug, organizationSlug }, token.secret),
      readProjectInfo({ projectSlug, organizationSlug }, token.secret),
      readOrganizationInfo({ organizationSlug }, token.secret),
    ]);

    // Makes sure that the data is accessible
    await expect(targetResult.expectNoGraphQLErrors()).resolves.toEqual(
      expect.objectContaining({
        target: expect.objectContaining({
          slug: targetSlug,
        }),
      }),
    );
    await expect(projectResult.expectNoGraphQLErrors()).resolves.toEqual(
      expect.objectContaining({
        project: expect.objectContaining({
          slug: projectSlug,
        }),
      }),
    );
    await expect(organizationResult.expectNoGraphQLErrors()).resolves.toEqual(
      expect.objectContaining({
        organization: expect.objectContaining({
          slug: organizationSlug,
        }),
      }),
    );
  },
);

test.concurrent(
  'setting target:registry:read and target:registry:write should allow to read the organization, project, target data',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    const targetSlug = target.slug;
    const projectSlug = project.slug;
    const organizationSlug = organization.slug;

    // member should not have access to target:registry:write
    const token = await createTargetAccessToken({
      mode: 'readWrite',
    });
    const tokenInfo = await token.fetchTokenInfo();
    if (tokenInfo.__typename === 'TokenNotFoundError') {
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
    expect(tokenInfo?.hasTargetRegistryRead).toBe(true);
    expect(tokenInfo?.hasTargetRegistryWrite).toBe(true);
    expect(tokenInfo?.hasTargetTokensRead).toBe(false);
    expect(tokenInfo?.hasTargetTokensWrite).toBe(false);

    // read the organization, project, target data
    const [targetResult, projectResult, organizationResult] = await Promise.all([
      readTargetInfo({ targetSlug, projectSlug, organizationSlug }, token.secret),
      readProjectInfo({ projectSlug, organizationSlug }, token.secret),
      readOrganizationInfo({ organizationSlug }, token.secret),
    ]);

    // Makes sure that the data is accessible
    await expect(targetResult.expectNoGraphQLErrors()).resolves.toEqual(
      expect.objectContaining({
        target: expect.objectContaining({
          slug: targetSlug,
        }),
      }),
    );
    await expect(projectResult.expectNoGraphQLErrors()).resolves.toEqual(
      expect.objectContaining({
        project: expect.objectContaining({
          slug: projectSlug,
        }),
      }),
    );
    await expect(organizationResult.expectNoGraphQLErrors()).resolves.toEqual(
      expect.objectContaining({
        organization: expect.objectContaining({
          slug: organizationSlug,
        }),
      }),
    );
  },
);

test.concurrent(
  'tokenInfo response cache is not shared between requests with different X-API-Token headers',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Single);
    const token = await createTargetAccessToken({ mode: 'readOnly' });

    const endpoint = `http://${await getServiceHost('server', 8082)}/graphql`;
    // JWT-like value (contains a dot), so the target access token strategy ignores it
    const authorization = `Bearer ${crypto.randomUUID()}.poison`;
    const fetchTokenInfoTypename = (headers: Record<string, string>) =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization, ...headers },
        body: JSON.stringify({ query: '{ tokenInfo { __typename } }' }),
      })
        .then(res => res.json())
        .then(body => body.data?.tokenInfo?.__typename);

    // authenticated via X-API-Token, response gets cached
    expect(await fetchTokenInfoTypename({ 'x-api-token': token.secret })).toEqual('TokenInfo');
    // same Authorization header, but no X-API-Token -> must not hit the cached response
    expect(await fetchTokenInfoTypename({})).toEqual('TokenNotFoundError');
  },
);
