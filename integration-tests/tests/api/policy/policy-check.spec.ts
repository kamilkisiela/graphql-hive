import stripAnsi from 'strip-ansi';
import { prepareProject } from 'testkit/registry-models';
import { ProjectType, RuleInstanceSeverityLevel, SchemaPolicyInput } from '@app/gql/graphql';
import { createCLI } from '../../../testkit/cli';

export const createPolicy = (level: RuleInstanceSeverityLevel): SchemaPolicyInput => ({
  rules: [
    {
      ruleId: 'require-description',
      severity: level,
      configuration: {
        types: true,
      },
    },
  ],
});

describe('Schema policy checks', () => {
  describe('model: composite', () => {
    it('Fedearation project with policy with only warnings, should check only the part that was changed', async () => {
      const { tokens, policy } = await prepareProject(ProjectType.Federation);
      await policy.setOrganizationSchemaPolicy(
        createPolicy(RuleInstanceSeverityLevel.Warning),
        true,
      );
      const cli = await createCLI(tokens.registry);

      await cli.publish({
        sdl: /* GraphQL */ `
          type Product @key(fields: "id") {
            id: ID!
            title: String
            url: String
          }

          extend type Query {
            product(id: ID!): Product
          }
        `,
        serviceName: 'products',
        serviceUrl: 'https://api.com/products',
        expect: 'latest-composable',
      });

      await cli.publish({
        sdl: /* GraphQL */ `
          type User @key(fields: "id") {
            id: ID!
            name: String!
          }

          extend type Query {
            user(id: ID!): User
          }
        `,
        serviceName: 'users',
        serviceUrl: 'https://api.com/users',
        expect: 'latest-composable',
      });

      const rawMessage = await cli.check({
        sdl: /* GraphQL */ `
          type User @key(fields: "id") {
            id: ID!
            name: String!
          }

          extend type Query {
            user(id: ID!): User
          }
        `,
        serviceName: 'users',
        expect: 'approved',
      });
      const message = stripAnsi(rawMessage);

      expect(message).toContain(`Detected 1 warning`);
      expect(message).toMatchInlineSnapshot(`
        v No changes
        ⚠ Detected 1 warning
        - Description is required for type User (source: policy-require-description)
      `);
    });

    it('Fedearation project with policy with , should check only the part that was changed', async () => {
      const { tokens, policy } = await prepareProject(ProjectType.Federation);
      await policy.setOrganizationSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Error), true);
      const cli = await createCLI(tokens.registry);

      await cli.publish({
        sdl: /* GraphQL */ `
          type Product @key(fields: "id") {
            id: ID!
            title: String
            url: String
          }

          extend type Query {
            product(id: ID!): Product
          }
        `,
        serviceName: 'products',
        serviceUrl: 'https://api.com/products',
        expect: 'latest-composable',
      });

      await cli.publish({
        sdl: /* GraphQL */ `
          type User @key(fields: "id") {
            id: ID!
            name: String!
          }

          extend type Query {
            user(id: ID!): User
          }
        `,
        serviceName: 'users',
        serviceUrl: 'https://api.com/users',
        expect: 'latest-composable',
      });

      const rawMessage = await cli.check({
        sdl: /* GraphQL */ `
          type User @key(fields: "id") {
            id: ID!
            name: String!
          }

          extend type Query {
            user(id: ID!): User
          }
        `,
        serviceName: 'users',
        expect: 'rejected',
      });
      const message = stripAnsi(rawMessage);

      expect(message).toContain(`Detected 1 error`);
      expect(message.split('\n').slice(1).join('\n')).toMatchInlineSnapshot(`
        ✖ Detected 1 error

           - Description is required for type User (source: policy-require-description)
      `);
    });
  });

  describe('model: single', () => {
    test('Single with policy with only warnings', async () => {
      const { tokens, policy } = await prepareProject(ProjectType.Single);
      await policy.setOrganizationSchemaPolicy(
        createPolicy(RuleInstanceSeverityLevel.Warning),
        true,
      );
      const cli = await createCLI(tokens.registry);

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            foo: String!
          }
        `,
        expect: 'latest-composable',
      });

      const rawMessage = await cli.check({
        sdl: /* GraphQL */ `
          type Query {
            foo: String!
            user: User!
          }

          type User {
            name: String!
          }
        `,
        expect: 'approved',
      });
      const message = stripAnsi(rawMessage);

      expect(message).toContain(`Detected 2 warnings`);
      expect(message).toMatchInlineSnapshot(`
        i Detected 2 changes
        - Type User was added
        - Field user was added to object type Query
        ⚠ Detected 2 warnings
        - Description is required for type Query (source: policy-require-description)
        - Description is required for type User (source: policy-require-description)
      `);
    });

    test('Single with policy with only errors', async () => {
      const { tokens, policy } = await prepareProject(ProjectType.Single);
      await policy.setOrganizationSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Error), true);
      const cli = await createCLI(tokens.registry);

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            foo: String!
          }
        `,
        expect: 'latest-composable',
      });

      const rawMessage = await cli.check({
        sdl: /* GraphQL */ `
          type Query {
            foo: String!
            user: User!
          }

          type User {
            name: String!
          }
        `,
        expect: 'rejected',
      });
      const message = stripAnsi(rawMessage);

      expect(message).toContain(`Detected 2 errors`);
      expect(message.split('\n').slice(1).join('\n')).toMatchInlineSnapshot(`
        ✖ Detected 2 errors
        - Description is required for type Query (source: policy-require-description)
        - Description is required for type User (source: policy-require-description)
        i Detected 2 changes
        - Type User was added
        - Field user was added to object type Query
      `);
    });

    test('Single with policy with both errors and warning', async () => {
      const { tokens, policy } = await prepareProject(ProjectType.Single);
      await policy.setOrganizationSchemaPolicy(
        {
          rules: [
            {
              ruleId: 'require-description',
              severity: RuleInstanceSeverityLevel.Error,
              configuration: {
                types: true,
              },
            },
            {
              ruleId: 'require-deprecation-reason',
              severity: RuleInstanceSeverityLevel.Warning,
            },
          ],
        },
        true,
      );
      const cli = await createCLI(tokens.registry);

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            foo: String!
          }
        `,
        expect: 'latest-composable',
      });

      const rawMessage = await cli.check({
        sdl: /* GraphQL */ `
          type Query {
            foo: String! @deprecated(reason: "")
            user: User!
          }

          type User {
            name: String!
          }
        `,
        expect: 'rejected',
      });
      const message = stripAnsi(rawMessage);

      expect(message).toContain(`Detected 2 errors`);
      expect(message).toContain(`Detected 1 warning`);
      expect(message.split('\n').slice(1).join('\n')).toMatchInlineSnapshot(`
        ✖ Detected 2 errors
        - Description is required for type Query (source: policy-require-description)
        - Description is required for type User (source: policy-require-description)
        ⚠ Detected 1 warning
        - Deprecation reason is required for field foo in type Query. (source: policy-require-deprecation-reason)
        i Detected 3 changes
        - Type User was added
        - Field user was added to object type Query
        - Field Query.foo is deprecated
      `);
    });
  });
});
