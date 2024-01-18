import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';

const CreateContractMutation = graphql(`
  mutation CreateContractMutation1($input: CreateContractInput!) {
    createContract(input: $input) {
      ok {
        createdContract {
          id
          target {
            id
          }
          includeTags
          excludeTags
          createdAt
        }
      }
      error {
        message
        details {
          targetId
          contractName
          includeTags
          excludeTags
        }
      }
    }
  }
`);

test.concurrent('schema check with successful contract checks', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  const { createToken, target, setNativeFederation } = await createProject(ProjectType.Federation);
  await setFeatureFlag('compareToPreviousComposableVersion', true);
  await setNativeFederation(true);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String
          helloHidden: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Check schema with no read and write rights
  const checkResult = await writeToken
    .checkSchema(
      /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          meh: String!
          mehHidden: String @tag(name: "toyota")
        }
      `,
      'meh',
    )
    .then(r => r.expectNoGraphQLErrors());
  expect(checkResult.schemaCheck.__typename).toBe('SchemaCheckSuccess');
});

test.concurrent('schema check with failing contract composition', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  const { createToken, target, setNativeFederation } = await createProject(ProjectType.Federation);
  await setFeatureFlag('compareToPreviousComposableVersion', true);
  await setNativeFederation(true);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Check schema with no read and write rights
  const checkResult = await writeToken
    .checkSchema(
      /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          meh: String! @tag(name: "toyota")
          mehHidden: String @tag(name: "toyota")
        }
      `,
      'meh',
    )
    .then(r => r.expectNoGraphQLErrors());

  expect(checkResult.schemaCheck.__typename).toBe('SchemaCheckError');
  if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
    throw new Error(`Expected SchemaCheckError, got ${checkResult.schemaCheck.__typename}`);
  }

  expect(checkResult.schemaCheck.errors?.nodes).toMatchInlineSnapshot(`
    [
      {
        message: [my-contract] Type "Query" is in the API schema but all of its fields are @inaccessible.,
      },
    ]
  `);
});

test.concurrent(
  'schema check with failing contract composition (multiple contracts)',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, setFeatureFlag } = await createOrg();
    const { createToken, target, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String @tag(name: "toyota")
            helloHidden: String @tag(name: "toyota")
          }
        `,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    let createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          excludeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName: 'my-other-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['fiat'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Check schema with no read and write rights
    const checkResult = await writeToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            meh: String! @tag(name: "toyota")
            mehHidden: String @tag(name: "toyota")
          }
        `,
        'meh',
      )
      .then(r => r.expectNoGraphQLErrors());

    expect(checkResult.schemaCheck.__typename).toBe('SchemaCheckError');

    if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${checkResult.schemaCheck.__typename}`);
    }

    expect(checkResult.schemaCheck.errors?.nodes).toMatchInlineSnapshot(`
    [
      {
        message: [my-contract] Type "Query" is in the API schema but all of its fields are @inaccessible.,
      },
      {
        message: [my-other-contract] Type "Query" is in the API schema but all of its fields are @inaccessible.,
      },
    ]
  `);
  },
);

const ApproveFailedSchemaCheckMutation = graphql(/* GraphQL */ `
  mutation ApproveFailedSchemaCheck($input: ApproveFailedSchemaCheckInput!) {
    approveFailedSchemaCheck(input: $input) {
      ok {
        schemaCheck {
          __typename
          ... on SuccessfulSchemaCheck {
            isApproved
            approvedBy {
              __typename
            }
          }
        }
      }
      error {
        message
      }
    }
  }
`);

const SchemaCheckQuery = graphql(/* GraphQL */ `
  query SchemaCheckContractsQuery($selector: TargetSelectorInput!, $id: ID!) {
    target(selector: $selector) {
      schemaCheck(id: $id) {
        __typename
        id
        createdAt
        ... on FailedSchemaCheck {
          compositionErrors {
            nodes {
              message
              path
            }
          }
          canBeApproved
          canBeApprovedByViewer
        }
        safeSchemaChanges {
          nodes {
            criticality
            criticalityReason
            message
            path
            approval {
              schemaCheckId
              approvedAt
              approvedBy {
                id
                displayName
              }
            }
          }
        }
        breakingSchemaChanges {
          nodes {
            criticality
            criticalityReason
            message
            path
            approval {
              schemaCheckId
              approvedAt
              approvedBy {
                id
                displayName
              }
            }
          }
        }
        contractChecks {
          edges {
            node {
              id
              contractName
              isSuccess
              breakingSchemaChanges {
                nodes {
                  criticality
                  criticalityReason
                  message
                  path
                  approval {
                    schemaCheckId
                    approvedAt
                    approvedBy {
                      id
                      displayName
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

test.concurrent(
  'approve failed schema check that has breaking change in contract check -> updates the status to successful and attaches meta information to the breaking change',
  async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, setFeatureFlag } = await createOrg();
    const { createToken, project, target, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const service = 'hello';
    const serviceUrl = 'http://hello.com';
    const contractName = 'my-contract';

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName,
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String @tag(name: "toyota")
          }
        `,
        service,
        url: serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Create a token with read rights
    const readToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead],
      projectScopes: [],
      organizationScopes: [],
    });

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String
          }
        `,
        service,
      )
      .then(r => r.expectNoGraphQLErrors());

    const check = checkResult.schemaCheck;

    if (check.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
    }

    const schemaCheckId = check.schemaCheck?.id;

    if (schemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const mutationResult = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
          schemaCheckId,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(mutationResult).toEqual({
      approveFailedSchemaCheck: {
        ok: {
          schemaCheck: {
            __typename: 'SuccessfulSchemaCheck',
            isApproved: true,
            approvedBy: {
              __typename: 'User',
            },
          },
        },
        error: null,
      },
    });

    const schemaCheck = await execute({
      document: SchemaCheckQuery,
      variables: {
        selector: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
        },
        id: schemaCheckId,
      },
      authToken: readToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(schemaCheck?.target?.schemaCheck).toMatchObject({
      __typename: 'SuccessfulSchemaCheck',
      breakingSchemaChanges: null,
      contractChecks: {
        edges: [
          {
            node: {
              id: expect.any(String),
              contractName,
              isSuccess: true,
              breakingSchemaChanges: {
                nodes: [
                  {
                    message: "Field 'helloHidden' was removed from object type 'Query'",
                    approval: {
                      approvedAt: expect.any(String),
                      approvedBy: {
                        id: expect.any(String),
                        displayName: expect.any(String),
                      },
                      schemaCheckId,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });
  },
);

test.concurrent(
  'approving a schema check with contextId containing breaking changes allows the changes for subsequent checks with the same contextId',
  async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, setFeatureFlag } = await createOrg();
    const { createToken, project, target, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const service = 'hello';
    const serviceUrl = 'http://hello.com';
    const contractName = 'my-contract';
    const contextId = 'pr-69420';

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName,
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String @tag(name: "toyota")
          }
        `,
        service,
        url: serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Create a token with read rights
    const readToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead],
      projectScopes: [],
      organizationScopes: [],
    });

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String
          }
        `,
        service,
        undefined,
        contextId,
      )
      .then(r => r.expectNoGraphQLErrors());

    const check = checkResult.schemaCheck;

    if (check.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
    }

    const schemaCheckId = check.schemaCheck?.id;

    if (schemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const mutationResult = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
          schemaCheckId,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(mutationResult).toEqual({
      approveFailedSchemaCheck: {
        ok: {
          schemaCheck: {
            __typename: 'SuccessfulSchemaCheck',
            isApproved: true,
            approvedBy: {
              __typename: 'User',
            },
          },
        },
        error: null,
      },
    });

    const secondCheckResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String
          }
        `,
        service,
        undefined,
        contextId,
      )
      .then(r => r.expectNoGraphQLErrors());

    if (secondCheckResult.schemaCheck.__typename !== 'SchemaCheckSuccess') {
      throw new Error(`Expected SchemaCheckSuccess, got ${check.__typename}`);
    }

    const newSchemaCheckId = secondCheckResult.schemaCheck.schemaCheck?.id;

    if (newSchemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const newSchemaCheck = await execute({
      document: SchemaCheckQuery,
      variables: {
        selector: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
        },
        id: newSchemaCheckId,
      },
      authToken: readToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(newSchemaCheck?.target?.schemaCheck).toMatchObject({
      __typename: 'SuccessfulSchemaCheck',
      breakingSchemaChanges: null,
      contractChecks: {
        edges: [
          {
            node: {
              id: expect.any(String),
              contractName,
              isSuccess: true,
              breakingSchemaChanges: {
                nodes: [
                  {
                    message: "Field 'helloHidden' was removed from object type 'Query'",
                    approval: {
                      approvedAt: expect.any(String),
                      approvedBy: {
                        id: expect.any(String),
                        displayName: expect.any(String),
                      },
                      schemaCheckId,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });
  },
);

test.concurrent(
  'approving a schema check with contextId containing breaking changes does not allow the changes for subsequent checks with a different contextId',
  async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, setFeatureFlag } = await createOrg();
    const { createToken, project, target, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const service = 'hello';
    const serviceUrl = 'http://hello.com';
    const contractName = 'my-contract';
    const contextId = 'pr-69420';

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName,
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String @tag(name: "toyota")
          }
        `,
        service,
        url: serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Create a token with read rights
    const readToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead],
      projectScopes: [],
      organizationScopes: [],
    });

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String
          }
        `,
        service,
        undefined,
        contextId,
      )
      .then(r => r.expectNoGraphQLErrors());

    const check = checkResult.schemaCheck;

    if (check.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
    }

    const schemaCheckId = check.schemaCheck?.id;

    if (schemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const mutationResult = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
          schemaCheckId,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(mutationResult).toEqual({
      approveFailedSchemaCheck: {
        ok: {
          schemaCheck: {
            __typename: 'SuccessfulSchemaCheck',
            isApproved: true,
            approvedBy: {
              __typename: 'User',
            },
          },
        },
        error: null,
      },
    });

    const secondCheckResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String
          }
        `,
        service,
        undefined,
        contextId + contextId,
      )
      .then(r => r.expectNoGraphQLErrors());

    if (secondCheckResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
    }

    const newSchemaCheckId = secondCheckResult.schemaCheck.schemaCheck?.id;

    if (newSchemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const newSchemaCheck = await execute({
      document: SchemaCheckQuery,
      variables: {
        selector: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
        },
        id: newSchemaCheckId,
      },
      authToken: readToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(newSchemaCheck?.target?.schemaCheck).toMatchObject({
      __typename: 'FailedSchemaCheck',
      breakingSchemaChanges: null,
      contractChecks: {
        edges: [
          {
            node: {
              id: expect.any(String),
              contractName,
              isSuccess: false,
              breakingSchemaChanges: {
                nodes: [
                  {
                    message: "Field 'helloHidden' was removed from object type 'Query'",
                    approval: null,
                  },
                ],
              },
            },
          },
        ],
      },
    });
  },
);

test.concurrent(
  'subsequent schema check with shared contextId that contains new breaking changes that have not been approved fails',
  async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, setFeatureFlag } = await createOrg();
    const { createToken, project, target, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const service = 'hello';
    const serviceUrl = 'http://hello.com';
    const contractName = 'my-contract';
    const contextId = 'pr-69420';

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName,
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String @tag(name: "toyota")
          }
        `,
        service,
        url: serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Create a token with read rights
    const readToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead],
      projectScopes: [],
      organizationScopes: [],
    });

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String @tag(name: "toyota")
            helloHidden: String
          }
        `,
        service,
        undefined,
        contextId,
      )
      .then(r => r.expectNoGraphQLErrors());

    const check = checkResult.schemaCheck;

    if (check.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
    }

    const schemaCheckId = check.schemaCheck?.id;

    if (schemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const mutationResult = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
          schemaCheckId,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(mutationResult).toEqual({
      approveFailedSchemaCheck: {
        ok: {
          schemaCheck: {
            __typename: 'SuccessfulSchemaCheck',
            isApproved: true,
            approvedBy: {
              __typename: 'User',
            },
          },
        },
        error: null,
      },
    });

    const secondCheckResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            hello: String
            helloHidden: String
          }
        `,
        service,
        undefined,
        contextId,
      )
      .then(r => r.expectNoGraphQLErrors());

    if (secondCheckResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
    }

    const newSchemaCheckId = secondCheckResult.schemaCheck.schemaCheck?.id;

    if (newSchemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const newSchemaCheck = await execute({
      document: SchemaCheckQuery,
      variables: {
        selector: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
        },
        id: newSchemaCheckId,
      },
      authToken: readToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(newSchemaCheck?.target?.schemaCheck).toMatchObject({
      __typename: 'FailedSchemaCheck',
      breakingSchemaChanges: null,
      contractChecks: {
        edges: [
          {
            node: {
              id: expect.any(String),
              contractName,
              isSuccess: false,
              breakingSchemaChanges: {
                nodes: [
                  {
                    message: "Field 'hello' was removed from object type 'Query'",
                    approval: null,
                  },
                  {
                    message: "Field 'helloHidden' was removed from object type 'Query'",
                    approval: {
                      approvedAt: expect.any(String),
                      approvedBy: {
                        id: expect.any(String),
                        displayName: expect.any(String),
                      },
                      schemaCheckId,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });
  },
);

test.concurrent(
  'schema check that has no composition errors in contract check -> can be approved',
  async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, setFeatureFlag } = await createOrg();
    const { createToken, project, target, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const service = 'hello';
    const serviceUrl = 'http://hello.com';
    const contractName = 'my-contract';

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName,
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
            b: String @tag(name: "toyota")
          }
        `,
        service,
        url: serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Create a token with read rights
    const readToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead],
      projectScopes: [],
      organizationScopes: [],
    });

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String
            b: String @tag(name: "toyota")
          }
        `,
        service,
        undefined,
      )
      .then(r => r.expectNoGraphQLErrors());

    if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${checkResult.schemaCheck.__typename}`);
    }

    const schemaCheckId = checkResult.schemaCheck.schemaCheck?.id;

    if (schemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const schemaCheck = await execute({
      document: SchemaCheckQuery,
      variables: {
        selector: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
        },
        id: schemaCheckId,
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(schemaCheck?.target?.schemaCheck).toMatchObject({
      __typename: 'FailedSchemaCheck',
      id: expect.any(String),
      canBeApproved: true,
      canBeApprovedByViewer: true,
    });
  },
);

test.concurrent(
  'schema check that has composition errors in contract check -> can not be approved',
  async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization, setFeatureFlag } = await createOrg();
    const { createToken, project, target, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const service = 'hello';
    const serviceUrl = 'http://hello.com';
    const contractName = 'my-contract';

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName,
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String @tag(name: "toyota")
          }
        `,
        service,
        url: serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Create a token with read rights
    const readToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead],
      projectScopes: [],
      organizationScopes: [],
    });

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            a: String
          }
        `,
        service,
        undefined,
      )
      .then(r => r.expectNoGraphQLErrors());

    if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${checkResult.schemaCheck.__typename}`);
    }

    const schemaCheckId = checkResult.schemaCheck.schemaCheck?.id;

    if (schemaCheckId == null) {
      throw new Error('Missing schema check id.');
    }

    const schemaCheck = await execute({
      document: SchemaCheckQuery,
      variables: {
        selector: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
        },
        id: schemaCheckId,
      },
      authToken: readToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(schemaCheck?.target?.schemaCheck).toMatchObject({
      __typename: 'FailedSchemaCheck',
      id: expect.any(String),
      canBeApproved: false,
      canBeApprovedByViewer: false,
    });

    const mutationResult = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
          schemaCheckId,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(mutationResult).toEqual({
      approveFailedSchemaCheck: {
        ok: null,
        error: {
          message: 'Schema check has composition errors.',
        },
      },
    });
  },
);
