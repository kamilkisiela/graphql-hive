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

  /** To ensure existing policies dont break during upgrades */
  it.each(policies)('should support existing policies', async policy => {
    await expect(
      schemaPolicyApiRouter.createCaller({ req: { log: console } as any }).checkPolicy({
        source: 'type Query { foo: String }',
        schema: 'type Query { foo: String }',
        target: '1',
        policy,
      }),
    ).resolves.toBeDefined();
  });
});

/**
 * A list of policies representing existing rule options that we must support.
 * This includes different error levels, config options, and rule sets to capture
 * different interactions.
 */
const policies = [
  {
    'relay-edge-types': [
      2,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'Argument[type.type=InputObjectTypeDefinition]': {
          style: 'PascalCase',
          suffix: 'Args',
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          suffixes: ['PageInfo', 'Edge', 'Connection', 'Nested', 'Error', 'Payload'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-description': [
      2,
      {
        types: true,
        rootField: false,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        EnumValueDefinition: false,
        UnionTypeDefinition: true,
        InputValueDefinition: false,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'relay-connection-types': [2],
    'require-deprecation-date': [1, { argumentName: 'deleteBy' }],
    'require-deprecation-reason': [2],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'naming-convention': [
      1,
      {
        types: { style: 'PascalCase', forbiddenSuffixes: ['Failure'] },
        Argument: {
          style: 'camelCase',
          forbiddenPrefixes: ['userUuid'],
          forbiddenSuffixes: ['UserId', 'userUuid'],
        },
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: {
          style: 'UPPER_CASE',
          ignorePattern: '^federation_',
        },
        InputValueDefinition: {
          style: 'camelCase',
          forbiddenSuffixes: ['UserId'],
        },
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['post', 'put', 'mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription', 'subscribe'],
          forbiddenSuffixes: ['Subscription'],
        },
        'FieldDefinition[parent.name.value=/.*(Error|Exception)/]': {
          forbiddenPrefixes: ['message'],
          forbiddenSuffixes: ['Message'],
        },
      },
    ],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          types: [
            'MonetaryAmount',
            'PageInfo',
            'MarketReturn',
            'InvestmentCategory',
            'SecurityHeadline',
            'ETFPrice',
            'StatementLink',
            'Eligibility',
            'Image',
            'StringKeyAsset',
          ],
          suffixes: ['CurrencyAmount', 'Error', 'Exception', 'Failure'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-nullable-fields-with-oneof': [2],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    alphabetize: [1, { values: ['EnumTypeDefinition'], definitions: false }],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'no-scalar-result-type-on-mutation': [2],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: false,
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        DirectiveDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
      },
    ],
    'require-nullable-fields-with-oneof': [2],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-deprecation-date': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: false,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [1, { definitions: false }],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
  },
  {},
  {
    'require-deprecation-date': [1, { argumentName: 'deletionDate' }],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['FieldDefinition'],
        definitions: false,
      },
    ],
  },
  {
    'strict-id-in-types': [1, { acceptedIdNames: ['id'], acceptedIdTypes: ['ID'] }],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'strict-id-in-types': [1, { acceptedIdNames: ['id'], acceptedIdTypes: ['ID'] }],
    'require-description': [1, { types: true, rootField: true, DirectiveDefinition: true }],
    'no-unreachable-types': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'relay-arguments': [1, { includeBoth: true }],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'require-deprecation-date': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: false,
      },
    ],
    alphabetize: [1, { values: ['EnumTypeDefinition'], definitions: false }],
    'relay-arguments': [2, { includeBoth: false }],
    'relay-edge-types': [
      2,
      {
        withEdgeSuffix: false,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [2, { style: 'block' }],
    'naming-convention': [
      2,
      {
        types: {
          style: 'PascalCase',
          forbiddenPrefixes: ['Type', 'type'],
          forbiddenSuffixes: ['Type', 'type'],
        },
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        EnumTypeDefinition: {
          forbiddenPrefixes: ['enum', 'Enum'],
          forbiddenSuffixes: ['enum', 'Enum'],
        },
        FragmentDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['Fragment'],
          forbiddenSuffixes: ['Fragment'],
        },
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        UnionTypeDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['union', 'Union'],
          forbiddenSuffixes: ['union', 'Union'],
        },
        InputValueDefinition: 'camelCase',
        ObjectTypeDefinition: {
          forbiddenPrefixes: ['Type'],
          forbiddenSuffixes: ['Type'],
        },
        InterfaceTypeDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['interface', 'Interface'],
          forbiddenSuffixes: ['interface', 'Interface'],
        },
        InputObjectTypeDefinition: 'PascalCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get', 'list'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          requiredPrefixes: ['create', 'update', 'delete', 'terminate', 'add', 'remove'],
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'relay-connection-types': [2],
    'require-deprecation-reason': [2],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition', 'Directive'],
        definitions: false,
      },
    ],
    'no-root-type': [1, { disallow: ['mutation', 'subscription'] }],
    'relay-arguments': [1, { includeBoth: true }],
    'description-style': [1, { style: 'inline' }],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'strict-id-in-types': [1, { acceptedIdNames: ['id'], acceptedIdTypes: ['ID'] }],
    'require-description': [
      2,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        EnumValueDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'no-unreachable-types': [1],
    'require-deprecation-date': [1],
    'require-type-pattern-with-oneof': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
    'require-field-of-type-query-in-mutation-result': [1],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition'],
        definitions: true,
      },
    ],
    'relay-arguments': [2, { includeBoth: true }],
    'relay-edge-types': [
      2,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [2, { style: 'block' }],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        allowLeadingUnderscore: true,
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'create', 'delete', 'get', 'is', 'remove', 'set', 'update'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: [
            'mutation',
            'create',
            'delete',
            'get',
            'is',
            'remove',
            'set',
            'update',
          ],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-description': [2, { rootField: true }],
    'relay-connection-types': [2],
    'require-deprecation-reason': [2],
    'no-scalar-result-type-on-mutation': [2],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['Field', 'Directive', 'DirectiveDefinition', 'FieldDefinition'],
        definitions: true,
      },
    ],
  },
  {
    alphabetize: [
      2,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        arguments: ['Field', 'FieldDefinition'],
        definitions: false,
      },
    ],
  },
  { 'strict-id-in-types': [0] },
  {
    'require-description': [
      1,
      {
        types: true,
        rootField: false,
        FieldDefinition: false,
        EnumTypeDefinition: false,
        DirectiveDefinition: false,
        OperationDefinition: false,
        InputValueDefinition: false,
        ScalarTypeDefinition: false,
        InputObjectTypeDefinition: false,
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: false,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      2,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition', 'Directive'],
        definitions: true,
      },
    ],
    'description-style': [2, { style: 'block' }],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        EnumValueDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'no-unreachable-types': [1],
    'require-deprecation-date': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
    'require-field-of-type-query-in-mutation-result': [1],
  },
  { 'require-deprecation-reason': [1] },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'no-root-type': [1, { disallow: ['subscription'] }],
    'description-style': [1, { style: 'block' }],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'PascalCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'no-unreachable-types': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'require-description': [
      1,
      {
        types: true,
        DirectiveDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'relay-arguments': [1, { includeBoth: true }],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
  },
  {
    'input-name': [0],
    alphabetize: [0],
    'relay-arguments': [0],
    'relay-page-info': [0],
    'relay-edge-types': [0],
    'naming-convention': [0],
    'no-hashtag-description': [0],
    'relay-connection-types': [0],
    'require-deprecation-reason': [0],
    'no-scalar-result-type-on-mutation': [0],
    'no-case-insensitive-enum-values-duplicates': [0],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get', 'list', 'fetch'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-description': [1, { types: true, rootField: true }],
    'no-unreachable-types': [1],
    'no-hashtag-description': [1],
    'require-deprecation-reason': [1],
    'require-nullable-result-in-root': [1],
    'no-scalar-result-type-on-mutation': [1],
  },
  {
    'no-root-type': [2, { disallow: ['subscription'] }],
    'relay-arguments': [2, { includeBoth: true }],
    'description-style': [2, { style: 'block' }],
    'relay-connection-types': [2],
    'require-deprecation-reason': [2],
    'no-scalar-result-type-on-mutation': [2],
    'require-nullable-fields-with-oneof': [2],
  },
  {
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'no-typename-prefix': [2],
    'require-deprecation-date': [2, { argumentName: 'deletionDate' }],
    'require-deprecation-reason': [2],
    'no-scalar-result-type-on-mutation': [2],
    'no-case-insensitive-enum-values-duplicates': [2],
  },
  {
    'relay-arguments': [1, { includeBoth: true }],
    'relay-page-info': [2],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'description-style': [2, { style: 'block' }],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'require-deprecation-reason': [2],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'relay-arguments': [1, { includeBoth: false }],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [2, { style: 'block' }],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: {
          style: 'UPPER_CASE',
          ignorePattern: '^(User)',
        },
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      2,
      {
        exceptions: {
          types: ['PageInfo', 'Email', 'Phone', 'TimeZone', 'Subscriber', 'Customer'],
          suffixes: ['Payload', 'Connection', 'Edge', 'Error'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'no-hashtag-description': [2],
    'relay-connection-types': [1],
    'require-deprecation-date': [1],
    'require-deprecation-reason': [2],
    'no-scalar-result-type-on-mutation': [2],
  },
];
