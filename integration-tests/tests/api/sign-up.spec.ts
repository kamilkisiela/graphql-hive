import { ProjectType } from '@app/gql/graphql';
import type { RateLimitApi } from '@hive/rate-limit';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { createFetch } from '@whatwg-node/fetch';
import { ensureEnv } from '../../testkit/env';
import { waitFor } from '../../testkit/flow';
import { execute } from '../../testkit/graphql';
import { initSeed } from '../../testkit/seed';
import { getServiceHost } from '../../testkit/utils';
import { graphql } from './../../testkit/gql';

const { fetch } = createFetch({
  useNodeFetch: true,
});

test.concurrent('should auto-create an organization for freshly signed-up user', async () => {
  const { ownerToken } = await initSeed().createOwner();
  const result = await execute({
    document: graphql(/* GraphQL */ `
      query organizations {
        organizations {
          total
          nodes {
            id
            name
          }
        }
      }
    `),
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result.organizations.total).toBe(1);
});

test.concurrent(
  'freshly signed-up user should have a Hobby plan with 7 days of retention',
  async () => {
    const { ownerToken, createPersonalProject } = await initSeed().createOwner();
    const result = await execute({
      document: graphql(/* GraphQL */ `
        query organizations {
          organizations {
            total
            nodes {
              id
              name
            }
          }
        }
      `),
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.organizations.total).toBe(1);

    const { target } = await createPersonalProject(ProjectType.Single);

    await waitFor(ensureEnv('LIMIT_CACHE_UPDATE_INTERVAL_MS', 'number') + 1_000); // wait for rate-limit to update

    const rateLimit = createTRPCProxyClient<RateLimitApi>({
      links: [
        httpLink({
          url: `http://${await getServiceHost('rate-limit', 3009)}/trpc`,
          fetch,
        }),
      ],
    });

    // Expect the default retention for a Hobby plan to be 7 days
    await expect(
      rateLimit.getRetention.query({
        targetId: target.id,
      }),
    ).resolves.toEqual(7);
  },
);

test.concurrent(
  'should auto-create an organization for freshly signed-up user with no race-conditions',
  async () => {
    const { ownerToken } = await initSeed().createOwner();
    const query1 = execute({
      document: graphql(/* GraphQL */ `
        query organizations {
          organizations {
            total
            nodes {
              id
              name
            }
          }
        }
      `),
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());
    const query2 = execute({
      document: graphql(/* GraphQL */ `
        query organizations {
          organizations {
            total
            nodes {
              id
              name
            }
          }
        }
      `),
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    const [result1, result2] = await Promise.all([query1, query2]);
    expect(result1.organizations.total).toBe(1);
    expect(result2.organizations.total).toBe(1);
  },
);
