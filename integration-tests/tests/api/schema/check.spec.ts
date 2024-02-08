import { ProjectType, RuleInstanceSeverityLevel, TargetAccessScope } from '@app/gql/graphql';
import { graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';
import { createPolicy } from '../policy/policy-check.spec';

test.concurrent('can check a schema with target:registry:read access', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
        }
      `,
    })
    .then(r => r.expectNoGraphQLErrors());
  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // Create a token with no rights
  const noAccessToken = await createToken({
    targetScopes: [],
    projectScopes: [],
    organizationScopes: [],
  });

  // Create a token with read rights
  const readToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead],
    projectScopes: [],
    organizationScopes: [],
  });

  // Check schema with no read and write rights
  const checkResultErrors = await noAccessToken
    .checkSchema(/* GraphQL */ `
      type Query {
        ping: String
        foo: String
      }
    `)
    .then(r => r.expectGraphQLErrors());
  expect(checkResultErrors).toHaveLength(1);
  expect(checkResultErrors[0].message).toMatch('target:registry:read');

  // Check schema with read rights
  const checkResultValid = await readToken
    .checkSchema(/* GraphQL */ `
      type Query {
        ping: String
        foo: String
      }
    `)
    .then(r => r.expectNoGraphQLErrors());
  expect(checkResultValid.schemaCheck.__typename).toBe('SchemaCheckSuccess');
});

test.concurrent('should match indentation of previous description', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [],
    organizationScopes: [],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          " ping-ping  "
          ping: String
          "pong-pong"
          pong: String
        }
      `,
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
    .checkSchema(/* GraphQL */ `
      type Query {
        """
        ping-ping
        """
        ping: String
        " pong-pong "
        pong: String
      }
    `)
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${check.__typename}`);
  }

  expect(check.__typename).toBe('SchemaCheckSuccess');
  expect(check.changes!.total).toBe(0);
});

const SchemaCheckQuery = graphql(/* GraphQL */ `
  query SchemaCheckOnTargetQuery($selector: TargetSelectorInput!, $id: ID!) {
    target(selector: $selector) {
      schemaCheck(id: $id) {
        __typename
        id
        createdAt
        schemaSDL
        serviceName
        schemaVersion {
          id
        }
        meta {
          commit
          author
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
        schemaPolicyWarnings {
          edges {
            node {
              message
              ruleId
              start {
                line
                column
              }
              end {
                line
                column
              }
            }
          }
        }
        ... on SuccessfulSchemaCheck {
          compositeSchemaSDL
          supergraphSDL
        }
        ... on FailedSchemaCheck {
          compositionErrors {
            nodes {
              message
              path
            }
          }
          schemaPolicyErrors {
            edges {
              node {
                message
                ruleId
                start {
                  line
                  column
                }
                end {
                  line
                  column
                }
              }
            }
          }
        }
      }
    }
  }
`);

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

test.concurrent('successful check without previously published schema is persisted', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, target } = await createProject(ProjectType.Single);

  // Create a token with read rights
  const readToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead],
    projectScopes: [],
    organizationScopes: [],
  });

  // Check schema with read rights
  const checkResult = await readToken
    .checkSchema(/* GraphQL */ `
      type Query {
        ping: String
        pong: String
      }
    `)
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${check.__typename}`);
  }

  const schemaCheckId = check.schemaCheck?.id;

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

  expect(schemaCheck).toMatchObject({
    target: {
      schemaCheck: {
        __typename: 'SuccessfulSchemaCheck',
        id: schemaCheckId,
        createdAt: expect.any(String),
        serviceName: null,
        schemaVersion: null,
      },
    },
  });
});

test.concurrent('successful check with previously published schema is persisted', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, target } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
          pong: String
        }
      `,
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
    .checkSchema(/* GraphQL */ `
      type Query {
        ping: String
        pong: String
      }
    `)
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${check.__typename}`);
  }

  const schemaCheckId = check.schemaCheck?.id;

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

  expect(schemaCheck).toMatchObject({
    target: {
      schemaCheck: {
        __typename: 'SuccessfulSchemaCheck',
        id: schemaCheckId,
        createdAt: expect.any(String),
        serviceName: null,
        schemaVersion: {
          id: expect.any(String),
        },
      },
    },
  });
});

test.concurrent('failed check due to graphql validation is persisted', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, target } = await createProject(ProjectType.Single);

  // Create a token with read rights
  const readToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead],
    projectScopes: [],
    organizationScopes: [],
  });

  // Check schema with read rights
  const checkResult = await readToken
    .checkSchema(/* GraphQL */ `
      type Query {
        ping: Str
      }
    `)
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckError') {
    throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
  }

  const schemaCheckId = check.schemaCheck?.id;

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

  expect(schemaCheck).toMatchObject({
    target: {
      schemaCheck: {
        __typename: 'FailedSchemaCheck',
        id: schemaCheckId,
        createdAt: expect.any(String),
        serviceName: null,
        schemaVersion: null,
        compositionErrors: {
          nodes: [
            {
              message: 'Unknown type "Str".',
            },
          ],
        },
      },
    },
  });
});

test.concurrent('failed check due to breaking change is persisted', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, target } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
        }
      `,
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
    .checkSchema(/* GraphQL */ `
      type Query {
        ping: Float
      }
    `)
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckError') {
    throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
  }

  const schemaCheckId = check.schemaCheck?.id;

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

  expect(schemaCheck).toMatchObject({
    target: {
      schemaCheck: {
        __typename: 'FailedSchemaCheck',
        id: schemaCheckId,
        createdAt: expect.any(String),
        serviceName: null,
        schemaVersion: {
          id: expect.any(String),
        },
        compositionErrors: null,
        breakingSchemaChanges: {
          nodes: [
            {
              message: "Field 'Query.ping' changed type from 'String' to 'Float'",
            },
          ],
        },
      },
    },
  });
});

test.concurrent('failed check due to policy error is persisted', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, target, setProjectSchemaPolicy } = await createProject(
    ProjectType.Single,
  );

  await setProjectSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Error));

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
        }
      `,
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
    .checkSchema(/* GraphQL */ `
      type Query {
        ping: String
        foo: String
      }
    `)
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckError') {
    throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
  }

  const schemaCheckId = check.schemaCheck?.id;

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

  expect(schemaCheck).toMatchObject({
    target: {
      schemaCheck: {
        __typename: 'FailedSchemaCheck',
        id: schemaCheckId,
        createdAt: expect.any(String),
        serviceName: null,
        schemaVersion: {
          id: expect.any(String),
        },
        compositionErrors: null,
        breakingSchemaChanges: null,
        schemaPolicyErrors: {
          edges: [
            {
              node: {
                end: {
                  column: 17,
                  line: 2,
                },
                message: 'Description is required for type "Query"',
                ruleId: 'require-description',
                start: {
                  column: 12,
                  line: 2,
                },
              },
            },
          ],
        },
      },
    },
  });
});

test.concurrent('successful check with warnings and safe changes is persisted', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, target, setProjectSchemaPolicy } = await createProject(
    ProjectType.Single,
  );

  await setProjectSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Warning));

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
        }
      `,
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
    .checkSchema(/* GraphQL */ `
      type Query {
        ping: String
        foo: String
      }
    `)
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${check.__typename}`);
  }

  const schemaCheckId = check.schemaCheck?.id;

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

  expect(schemaCheck).toMatchObject({
    target: {
      schemaCheck: {
        __typename: 'SuccessfulSchemaCheck',
        id: schemaCheckId,
        createdAt: expect.any(String),
        serviceName: null,
        schemaVersion: {
          id: expect.any(String),
        },
        schemaPolicyWarnings: {
          edges: [
            {
              node: {
                end: {
                  column: 17,
                  line: 2,
                },
                message: 'Description is required for type "Query"',
                ruleId: 'require-description',
                start: {
                  column: 12,
                  line: 2,
                },
              },
            },
          ],
        },
        safeSchemaChanges: {
          nodes: [
            {
              message: "Field 'foo' was added to object type 'Query'",
            },
          ],
        },
      },
    },
  });
});

test.concurrent(
  'failed check due to missing service name is not persisted (federation/stitching)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);

    const readToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead],
      projectScopes: [],
      organizationScopes: [],
    });

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(/* GraphQL */ `
        type Query {
          ping: String
          foo: String
        }
      `)
      .then(r => r.expectNoGraphQLErrors());
    const check = checkResult.schemaCheck;

    if (check.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${check.__typename}`);
    }

    expect(check.schemaCheck).toEqual(null);
  },
);

test.concurrent('metadata is persisted', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, target } = await createProject(ProjectType.Single);

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
        type Query {
          ping: String
          pong: String
        }
      `,
      undefined,
      {
        author: 'Freddy Gibbs',
        commit: '$oul $old $eparately',
      },
    )
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${check.__typename}`);
  }

  const schemaCheckId = check.schemaCheck?.id;

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

  expect(schemaCheck).toMatchObject({
    target: {
      schemaCheck: {
        __typename: 'SuccessfulSchemaCheck',
        id: schemaCheckId,
        createdAt: expect.any(String),
        serviceName: null,
        schemaVersion: null,
        meta: {
          author: 'Freddy Gibbs',
          commit: '$oul $old $eparately',
        },
      },
    },
  });
});

test.concurrent(
  'approve failed schema check that has breaking change status to successful and attaches meta information to the breaking change',
  async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
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
      .checkSchema(/* GraphQL */ `
        type Query {
          ping: Float
        }
      `)
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

    expect(schemaCheck).toMatchObject({
      target: {
        schemaCheck: {
          __typename: 'SuccessfulSchemaCheck',
          breakingSchemaChanges: {
            nodes: [
              {
                approval: {
                  schemaCheckId,
                  approvedAt: expect.any(String),
                  approvedBy: {
                    id: expect.any(String),
                    displayName: expect.any(String),
                  },
                },
              },
            ],
          },
        },
      },
    });
  },
);

test.concurrent(
  'approving a schema check with contextId containing breaking changes allows the changes for subsequent checks with the same contextId',
  async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
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

    const contextId = 'pr-69420';

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          type Query {
            ping: Float
          }
        `,
        undefined,
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
          type Query {
            ping: Float
          }
        `,
        undefined,
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

    expect(newSchemaCheck.target?.schemaCheck).toMatchObject({
      id: newSchemaCheckId,
      breakingSchemaChanges: {
        nodes: [
          {
            approval: {
              schemaCheckId,
              approvedAt: expect.any(String),
              approvedBy: {
                id: expect.any(String),
                displayName: expect.any(String),
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
    const { createProject, organization } = await createOrg();
    const { createToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
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

    const contextId = 'pr-69420';

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          type Query {
            ping: Float
          }
        `,
        undefined,
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
          type Query {
            ping: Float
          }
        `,
        undefined,
        undefined,
        contextId + '|' + contextId,
      )
      .then(r => r.expectNoGraphQLErrors());

    if (secondCheckResult.schemaCheck.__typename !== 'SchemaCheckError') {
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

    expect(newSchemaCheck.target?.schemaCheck).toMatchObject({
      id: newSchemaCheckId,
      breakingSchemaChanges: {
        nodes: [
          {
            approval: null,
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
    const { createProject, organization } = await createOrg();
    const { createToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    // Publish schema with write rights
    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
            pong: String
          }
        `,
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

    const contextId = 'pr-69420';

    // Check schema with read rights
    const checkResult = await readToken
      .checkSchema(
        /* GraphQL */ `
          type Query {
            ping: Float
          }
        `,
        undefined,
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
          type Query {
            ping: Float
            pong: Float
          }
        `,
        undefined,
        undefined,
        contextId,
      )
      .then(r => r.expectNoGraphQLErrors());

    if (secondCheckResult.schemaCheck.__typename !== 'SchemaCheckError') {
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

    expect(newSchemaCheck.target?.schemaCheck).toMatchObject({
      id: newSchemaCheckId,
      breakingSchemaChanges: {
        nodes: [
          {
            approval: {
              schemaCheckId,
              approvedAt: expect.any(String),
              approvedBy: {
                id: expect.any(String),
                displayName: expect.any(String),
              },
            },
          },
          {
            approval: null,
          },
        ],
      },
    });
  },
);

test.concurrent('contextId that has more than 300 characters is not allowed', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
          pong: String
        }
      `,
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

  const contextId = '';

  // Check schema with read rights
  const checkResult = await readToken
    .checkSchema(
      /* GraphQL */ `
        type Query {
          ping: Float
        }
      `,
      undefined,
      undefined,
      contextId,
    )
    .then(r => r.expectNoGraphQLErrors());

  expect(checkResult.schemaCheck).toMatchObject({
    __typename: 'SchemaCheckError',
    errors: {
      nodes: [
        {
          message: 'Context ID must be at least 1 character long.',
        },
      ],
    },
  });
});

test.concurrent('contextId that has fewer than 1 characters is not allowed', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
          pong: String
        }
      `,
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

  const contextId = new Array(201).fill('A').join('');

  // Check schema with read rights
  const checkResult = await readToken
    .checkSchema(
      /* GraphQL */ `
        type Query {
          ping: Float
        }
      `,
      undefined,
      undefined,
      contextId,
    )
    .then(r => r.expectNoGraphQLErrors());

  expect(checkResult.schemaCheck).toMatchObject({
    __typename: 'SchemaCheckError',
    errors: {
      nodes: [
        {
          message: 'Context ID cannot exceed length of 200 characters.',
        },
      ],
    },
  });
});

test.concurrent(
  'schema check composition skip due to unchanged input schemas when being compared to failed schema version',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, setFeatureFlag } = await createOrg();
    const { createToken, setNativeFederation } = await createProject(ProjectType.Federation);
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    const token = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    // here we use @tag without an argument to trigger a validation/composition error
    const sdl = /* GraphQL */ `
      extend schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

      type Query {
        ping: String
        pong: String
        foo: User @tag
      }

      type User {
        id: ID!
      }
    `;

    // Publish schema with write rights
    await token
      .publishSchema({
        sdl,
        service: 'serviceA',
        url: 'http://localhost:4000',
      })
      .then(r => r.expectNoGraphQLErrors());

    await token.checkSchema(sdl, 'serviceA').then(r => r.expectNoGraphQLErrors());
  },
);
