import { schemaPolicyApiRouter } from '../src/api';

describe('policy checks', () => {
  it('should return a known list of rules', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .availableRules();

    expect(Object.keys(result).length).toBe(22);
  });

  it('should return empty result where there are not lint rules', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .checkPolicy({
        source: 'type Query { foo: String }',
        schema: 'type Query { foo: String }',
        target: '1',
        policy: {},
      });

    expect(result.length).toBe(0);
  });

  it('should return errors correctly', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .checkPolicy({
        source: 'type Query { foo: String! }',
        schema: 'type Query { foo: String! }',
        target: '1',
        policy: {
          'require-nullable-result-in-root': ['error'],
        },
      });

    expect(result.length).toBe(1);
    expect(result).toMatchInlineSnapshot(`
      [
        {
          column: 19,
          endColumn: 25,
          endLine: 1,
          line: 1,
          message: Unexpected non-null result String in type "Query",
          messageId: require-nullable-result-in-root,
          nodeType: NonNullType,
          ruleId: require-nullable-result-in-root,
          severity: 2,
          suggestions: [
            {
              desc: Make String nullable,
              fix: {
                range: [
                  18,
                  25,
                ],
                text: String,
              },
            },
          ],
        },
      ]
    `);
  });

  it('should return warnings correctly', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .checkPolicy({
        source: 'type Query { foo: String }',
        schema: 'type Query { foo: String }',
        target: '1',
        policy: {
          'require-description': ['warn', { types: true, FieldDefinition: true }],
        },
      });

    expect(result.length).toBe(2);
    expect(result).toMatchInlineSnapshot(`
      [
        {
          column: 6,
          endColumn: 11,
          endLine: 1,
          line: 1,
          message: Description is required for type "Query",
          messageId: require-description,
          nodeType: null,
          ruleId: require-description,
          severity: 1,
        },
        {
          column: 14,
          endColumn: 17,
          endLine: 1,
          line: 1,
          message: Description is required for field "foo" in type "Query",
          messageId: require-description,
          nodeType: null,
          ruleId: require-description,
          severity: 1,
        },
      ]
    `);
  });

  it('refreshes edge types per run', async () => {
    const caller = schemaPolicyApiRouter.createCaller({ req: { log: console } as any });
    const userSchema = `
      type Query {
        # 'first' limits results; 'after' is the cursor to start from
        users(first: Int, after: String): UserConnection!
      }

      type UserConnection {
        edges: [UserEdge!]!
        pageInfo: PageInfo!
        totalCount: Int!
      }

      type UserEdge {
        node: User!
        cursor: String!
      }

      type PageInfo {
        hasNextPage: Boolean!
        endCursor: String
      }

      interface Node {
        id: ID!
      }

      type User {
        id: ID!
        name: String!
      }
    `;
    const result = await caller.checkPolicy({
      source: userSchema,
      schema: userSchema,
      target: '1',
      policy: {
        'relay-edge-types': [
          2,
          {
            withEdgeSuffix: true,
            shouldImplementNode: true,
            listTypeCanWrapOnlyEdgeType: false,
          },
        ],
      },
    });

    expect(result.length).toBe(1);
    expect(result[0].message).toBe("Edge type's field \`node\` must implement \`Node\` interface.");

    const noUserSchema = `
      type Query {
        # 'first' limits results; 'after' is the cursor to start from
        noUsers(first: Int, after: String): NoUserConnection!
      }

      type NoUserConnection {
        edges: [NoUserEdge!]!
        pageInfo: PageInfo!
        totalCount: Int!
      }

      type NoUserEdge {
        node: NoUser!
        cursor: String!
      }

      type PageInfo {
        hasNextPage: Boolean!
        endCursor: String
      }

      interface Node {
        id: ID!
      }

      type NoUser {
        id: ID!
        name: String!
      }
    `;
    const noUserResult = await caller.checkPolicy({
      source: noUserSchema,
      schema: noUserSchema,
      target: '1',
      policy: {
        'relay-edge-types': [
          2,
          {
            withEdgeSuffix: true,
            shouldImplementNode: true,
            listTypeCanWrapOnlyEdgeType: false,
          },
        ],
      },
    });

    expect(noUserResult.length).toBe(1);
    expect(noUserResult[0].message).toBe(
      "Edge type's field \`node\` must implement \`Node\` interface.",
    );
  });

  it('refreshes reachable types per run', async () => {
    const caller = schemaPolicyApiRouter.createCaller({ req: { log: console } as any });
    const unreachableSchema = `type Query { foo: String } type Foo { id: ID! }`;
    const reachableSchema = `type Query { foo: Foo } type Foo { id: ID! }`;
    const policy = { 'no-unreachable-types': [2] as [2] };

    const unreachableResult = await caller.checkPolicy({
      source: unreachableSchema,
      schema: unreachableSchema,
      target: '1',
      policy,
    });
    expect(unreachableResult.map(r => r.message)).toEqual(['Object type `Foo` is unreachable.']);

    const reachableResult = await caller.checkPolicy({
      source: reachableSchema,
      schema: reachableSchema,
      target: '1',
      policy,
    });
    expect(reachableResult).toHaveLength(0);
  });

  it('should support type extensions', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .checkPolicy({
        source: `type Query extend type Query { foo: Foo } type Foo { id: ID! }`,
        schema: `type Query extend type Query { foo: Foo } type Foo { id: ID! }`,
        target: '1',
        policy: {
          'no-unreachable-types': [2],
        },
      });
    expect(result).toHaveLength(0);
  });
});
