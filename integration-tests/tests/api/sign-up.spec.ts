import { gql } from '@app/gql';
import { execute } from '../../testkit/graphql';
import { initSeed } from '../../testkit/seed';

test.concurrent('should auto-create an organization for freshly signed-up user', async () => {
  const { ownerToken } = await initSeed().createOwner();
  const result = await execute({
    document: gql(/* GraphQL */ `
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
  'should auto-create an organization for freshly signed-up user with no race-conditions',
  async () => {
    const { ownerToken } = await initSeed().createOwner();
    const query1 = execute({
      document: gql(/* GraphQL */ `
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
      document: gql(/* GraphQL */ `
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
