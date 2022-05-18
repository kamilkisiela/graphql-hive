import { gql } from '@app/gql';
import { execute } from '../../testkit/graphql';
import { authenticate } from '../../testkit/auth';

test('should auto-create an organization for freshly signed-up user', async () => {
  const { access_token } = await authenticate('main');
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
    authToken: access_token,
  });

  expect(result.body.errors).not.toBeDefined();
  expect(result.body.data?.organizations.total).toBe(1);
});

test('should auto-create an organization for freshly signed-up user with no race-conditions', async () => {
  const { access_token } = await authenticate('main');
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
    authToken: access_token,
  });
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
    authToken: access_token,
  });
  const [result1, result2] = await Promise.all([query1, query2]);

  expect(result1.body.errors).not.toBeDefined();
  expect(result1.body.data?.organizations.total).toBe(1);
  expect(result2.body.errors).not.toBeDefined();
  expect(result2.body.data?.organizations.total).toBe(1);
});
