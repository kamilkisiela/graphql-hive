import {
  ProjectType,
  ResourceAssignmentModeType,
  RuleInstanceSeverityLevel,
} from 'testkit/gql/graphql';
import { SchemaVersionStore } from '@hive/api/modules/schema/providers/schema-version-store';
import { invariant } from '@hive/service-common';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createStorage } from '@hive/storage';
import { checkSchema } from '../../../testkit/flow';
import { graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';
import { createPolicy } from '../policy/policy-check.spec';

test.concurrent('can check a schema with target:registry:read access', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

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

  const noAccessToken = await createTargetAccessToken({
    mode: 'noAccess',
  });

  const readToken = await createTargetAccessToken({
    mode: 'readOnly',
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
  expect(checkResultErrors[0].message).toMatch(
    `No access (reason: "Missing permission for performing 'schemaCheck:create' on resource")`,
  );

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

test.concurrent('should match indentation of previous description', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

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
  const readToken = await createTargetAccessToken({
    mode: 'readOnly',
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
    target(reference: { bySelector: $selector }) {
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
          approvalComment
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
            approvalComment
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

test.concurrent(
  'successful check without previously published schema is persisted',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with read rights
    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        id: schemaCheckId,
      },
      authToken: ownerToken,
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
  },
);

test.concurrent('malformed check IDs do not raise an exception', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { project, target } = await createProject(ProjectType.Single);

  const result = await execute({
    document: ApproveFailedSchemaCheckMutation,
    variables: {
      input: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
        schemaCheckId: 'malformed-id',
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result.approveFailedSchemaCheck).toEqual({
    ok: null,
    error: {
      message: "Schema check doesn't exist.",
    },
  });
});

test.concurrent(
  'successful check with previously published schema is persisted',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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
    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        id: schemaCheckId,
      },
      authToken: ownerToken,
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
  },
);

test.concurrent('failed check due to graphql validation is persisted', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

  // Create a token with read rights
  const readToken = await createTargetAccessToken({
    mode: 'readOnly',
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
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      id: schemaCheckId,
    },
    authToken: ownerToken,
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

test.concurrent('failed check due to breaking change is persisted', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

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
  const readToken = await createTargetAccessToken({
    mode: 'readOnly',
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
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      id: schemaCheckId,
    },
    authToken: ownerToken,
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

test.concurrent('failed check due to policy error is persisted', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createTargetAccessToken, project, target, setProjectSchemaPolicy } = await createProject(
    ProjectType.Single,
  );

  await setProjectSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Error));

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

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
  const readToken = await createTargetAccessToken({
    mode: 'readOnly',
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
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      id: schemaCheckId,
    },
    authToken: ownerToken,
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
                  column: 11,
                  line: 1,
                },
                message: 'Description is required for type "Query"',
                ruleId: 'require-description',
                start: {
                  column: 6,
                  line: 1,
                },
              },
            },
          ],
        },
      },
    },
  });
});

test.concurrent(
  'successful check with warnings and safe changes is persisted',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target, setProjectSchemaPolicy } =
      await createProject(ProjectType.Single);

    await setProjectSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Warning));

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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
    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        id: schemaCheckId,
      },
      authToken: ownerToken,
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
                    column: expect.any(Number),
                    line: expect.any(Number),
                  },
                  message: 'Description is required for type "Query"',
                  ruleId: 'require-description',
                  start: {
                    column: expect.any(Number),
                    line: expect.any(Number),
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
  },
);

test.concurrent(
  'failed check due to missing service name is not persisted (federation/stitching)',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Federation);

    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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

test.concurrent('metadata is persisted', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

  // Create a token with read rights
  const readToken = await createTargetAccessToken({
    mode: 'readOnly',
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
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      id: schemaCheckId,
    },
    authToken: ownerToken,
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
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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
    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
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
            approvalComment: null,
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        id: schemaCheckId,
      },
      authToken: ownerToken,
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

test.concurrent('approve failed schema check with a comment', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

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
  const readToken = await createTargetAccessToken({
    mode: 'readOnly',
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
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
        schemaCheckId,
        comment: 'This is a comment',
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
          approvalComment: 'This is a comment',
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
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      id: schemaCheckId,
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(schemaCheck).toMatchObject({
    target: {
      schemaCheck: {
        __typename: 'SuccessfulSchemaCheck',
        approvalComment: 'This is a comment',
      },
    },
  });
});

test.concurrent(
  'approving a schema check with contextId containing breaking changes allows the changes for subsequent checks with the same contextId',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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
    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
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
            approvalComment: null,
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        id: newSchemaCheckId,
      },
      authToken: ownerToken,
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
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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
    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
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
            approvalComment: null,
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        id: newSchemaCheckId,
      },
      authToken: ownerToken,
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
  'can not approve schema check with insufficient permissions granted by default user role',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { organization, createProject, inviteAndJoinMember } = await createOrg();

    // Setup Start: Create a failed schema check

    const { project, createTargetAccessToken, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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

    const checkResult = await writeToken
      .checkSchema(/* GraphQL */ `
        type Query {
          ping: Float
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error('Invalid result: ' + checkResult.schemaCheck.__typename);
    }
    const schemaCheckId = await checkResult.schemaCheck.schemaCheck?.id;
    if (!schemaCheckId) {
      throw new Error('Invalid result: ' + JSON.stringify(checkResult, null, 2));
    }

    // Setup Done: Create a failed schema check

    // Create a member with no access to projects
    const { member, assignMemberRole, memberToken } = await inviteAndJoinMember();
    expect(member.role.name).toEqual('Viewer');
    await assignMemberRole({
      roleId: member.role.id,
      userId: member.user.id,
      resources: { mode: ResourceAssignmentModeType.Granular, projects: [] },
    });

    // Attempt approving the failed schema check
    const errors = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
          schemaCheckId,
        },
      },
      authToken: memberToken,
    }).then(r => r.expectGraphQLErrors());
    expect(errors).toHaveLength(1);
    expect(errors.at(0)).toMatchObject({
      extensions: {
        code: 'UNAUTHORISED',
      },
      message: `No access (reason: "Missing permission for performing 'schemaCheck:approve' on resource")`,
      path: ['approveFailedSchemaCheck'],
    });
  },
);

test.concurrent(
  'can not approve schema check with insufficient permissions granted by member role (no access to project resource)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { organization, createProject, inviteAndJoinMember } = await createOrg();

    // Setup Start: Create a failed schema check

    const { project, createTargetAccessToken, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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

    const checkResult = await writeToken
      .checkSchema(/* GraphQL */ `
        type Query {
          ping: Float
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error('Invalid result: ' + checkResult.schemaCheck.__typename);
    }
    const schemaCheckId = await checkResult.schemaCheck.schemaCheck?.id;
    if (!schemaCheckId) {
      throw new Error('Invalid result: ' + JSON.stringify(checkResult, null, 2));
    }

    // Setup Done: Create a failed schema check

    // Create a member with no access to projects
    const { member, assignMemberRole, createMemberRole, memberToken } = await inviteAndJoinMember();
    const memberRole = await createMemberRole(['schemaCheck:approve', 'project:describe']);
    await assignMemberRole({
      roleId: memberRole.id,
      userId: member.user.id,
      resources: { mode: ResourceAssignmentModeType.Granular, projects: [] },
    });

    // Attempt approving the failed schema check
    const errors = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
          schemaCheckId,
        },
      },
      authToken: memberToken,
    }).then(r => r.expectGraphQLErrors());
    expect(errors).toHaveLength(1);
    expect(errors.at(0)).toMatchObject({
      extensions: {
        code: 'UNAUTHORISED',
      },
      message: `No access (reason: "Missing permission for performing 'schemaCheck:approve' on resource")`,
      path: ['approveFailedSchemaCheck'],
    });
  },
);

test.concurrent(
  'can not approve schema check with insufficient permissions granted by member role (no access to target resource)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { organization, createProject, inviteAndJoinMember } = await createOrg();

    // Setup Start: Create a failed schema check

    const { project, createTargetAccessToken, target, targets } = await createProject(
      ProjectType.Single,
    );

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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

    const checkResult = await writeToken
      .checkSchema(/* GraphQL */ `
        type Query {
          ping: Float
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error('Invalid result: ' + checkResult.schemaCheck.__typename);
    }
    const schemaCheckId = await checkResult.schemaCheck.schemaCheck?.id;
    if (!schemaCheckId) {
      throw new Error('Invalid result: ' + JSON.stringify(checkResult, null, 2));
    }

    // Setup Done: Create a failed schema check

    // Create a member with no access to project targets
    const { member, createMemberRole, assignMemberRole, memberToken } = await inviteAndJoinMember();
    const memberRole = await createMemberRole(['schemaCheck:approve', 'project:describe']);
    await assignMemberRole({
      roleId: memberRole.id,
      userId: member.user.id,
      resources: {
        mode: ResourceAssignmentModeType.Granular,
        projects: [
          {
            projectId: project.id,
            targets: {
              mode: ResourceAssignmentModeType.Granular,
              targets: [],
            },
          },
        ],
      },
    });

    // Attempt approving the failed schema check
    const errors = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
          schemaCheckId,
        },
      },
      authToken: memberToken,
    }).then(r => r.expectGraphQLErrors());
    expect(errors).toHaveLength(1);
    expect(errors.at(0)).toMatchObject({
      extensions: {
        code: 'UNAUTHORISED',
      },
      message: `No access (reason: "Missing permission for performing 'schemaCheck:approve' on resource")`,
      path: ['approveFailedSchemaCheck'],
    });
  },
);

test.concurrent(
  'can approve schema with sufficient permissions granted by member role (access to target)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { organization, createProject, inviteAndJoinMember } = await createOrg();

    // Setup Start: Create a failed schema check

    const { project, createTargetAccessToken, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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

    const checkResult = await writeToken
      .checkSchema(/* GraphQL */ `
        type Query {
          ping: Float
        }
      `)
      .then(r => r.expectNoGraphQLErrors());

    if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error('Invalid result: ' + checkResult.schemaCheck.__typename);
    }
    const schemaCheckId = await checkResult.schemaCheck.schemaCheck?.id;
    if (!schemaCheckId) {
      throw new Error('Invalid result: ' + JSON.stringify(checkResult, null, 2));
    }

    // Setup Done: Create a failed schema check

    // Create a member with no access to projects
    const { member, createMemberRole, assignMemberRole, memberToken } = await inviteAndJoinMember();
    const memberRole = await createMemberRole(['schemaCheck:approve', 'project:describe']);
    await assignMemberRole({
      roleId: memberRole.id,
      userId: member.user.id,
      resources: {
        mode: ResourceAssignmentModeType.Granular,
        projects: [
          {
            projectId: project.id,
            targets: {
              mode: ResourceAssignmentModeType.Granular,
              targets: [
                {
                  targetId: target.id,
                  appDeployments: { mode: ResourceAssignmentModeType.All },
                  services: { mode: ResourceAssignmentModeType.All },
                },
              ],
            },
          },
        ],
      },
    });

    // Attempt approving the failed schema check
    const result = await execute({
      document: ApproveFailedSchemaCheckMutation,
      variables: {
        input: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
          schemaCheckId,
        },
      },
      authToken: memberToken,
    }).then(r => r.expectNoGraphQLErrors());
    expect(result.approveFailedSchemaCheck.ok).toMatchObject({
      schemaCheck: {
        __typename: 'SuccessfulSchemaCheck',
        isApproved: true,
      },
    });
  },
);

test.concurrent(
  'subsequent schema check with shared contextId that contains new breaking changes that have not been approved fails',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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
    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
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
            approvalComment: null,
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        id: newSchemaCheckId,
      },
      authToken: ownerToken,
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

test.concurrent(
  'contextId that has more than 300 characters is not allowed',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Single);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

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
    const readToken = await createTargetAccessToken({
      mode: 'readOnly',
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
  },
);

test.concurrent('contextId that has fewer than 1 characters is not allowed', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

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
  const readToken = await createTargetAccessToken({
    mode: 'readOnly',
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

describe.concurrent(
  'schema check composition skip due to unchanged input schemas when being compared to failed schema version',
  () => {
    test.concurrent('native federation', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken } = await createProject(ProjectType.Federation);

      const token = await createTargetAccessToken({});

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

      const result = await token.checkSchema(sdl, 'serviceA').then(r => r.expectNoGraphQLErrors());

      expect(result.schemaCheck).toMatchObject({
        valid: false,
        __typename: 'SchemaCheckError',
        changes: expect.objectContaining({
          total: 0,
        }),
        errors: expect.objectContaining({
          total: 1,
        }),
      });
    });

    test.concurrent('legacy fed composition', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, setNativeFederation } = await createProject(
        ProjectType.Federation,
      );
      await setNativeFederation(false);

      const token = await createTargetAccessToken({});

      // @key(fields:) is invalid - should trigger a composition error
      const sdl = /* GraphQL */ `
        type Query {
          ping: String
          pong: String
          foo: User
        }

        type User @key(fields: "uuid") {
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

      const result = await token.checkSchema(sdl, 'serviceA').then(r => r.expectNoGraphQLErrors());

      expect(result.schemaCheck).toMatchObject({
        valid: false,
        __typename: 'SchemaCheckError',
        changes: expect.objectContaining({
          total: 0,
        }),
        errors: expect.objectContaining({
          total: 1,
        }),
      });
    });
  },
);

describe.concurrent('schema check with a baseline service schema', () => {
  test.concurrent('compares a single schema against the provided baseline', async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Single);
    const token = await createTargetAccessToken({});

    await token
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            stable: String
            registryOnly: String
          }
        `,
      })
      .then(r => r.expectNoGraphQLErrors());

    const result = await checkSchema(
      {
        baseline: {
          hash: 'single-schema-baseline',
          sdl: /* GraphQL */ `
            type Query {
              stable: String
              baselineOnly: String
            }
          `,
        },
        sdl: /* GraphQL */ `
          type Query {
            stable: String
          }
        `,
      },
      token.secret,
    ).then(r => r.expectNoGraphQLErrors());

    expect(result.schemaCheck).toMatchObject({
      __typename: 'SchemaCheckError',
      valid: false,
      changes: {
        nodes: [
          {
            message: "Field 'baselineOnly' was removed from object type 'Query'",
          },
        ],
        total: 1,
      },
      schemaCheck: {
        baseline: {
          sdl: expect.stringContaining('baselineOnly: String'),
          publicSdl: expect.stringContaining('baselineOnly: String'),
          compositionErrors: null,
          meta: {
            commit: 'single-schema-baseline',
          },
        },
      },
    });
  });

  test.concurrent(
    'compares the baseline against the head when the head matches the registry',
    async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken } = await createProject(ProjectType.Federation);
      const token = await createTargetAccessToken({});

      const headSdl = /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

        type Query {
          product: Product
        }

        type Product @key(fields: "id") {
          id: ID!
        }
      `;

      await token
        .publishSchema({
          service: 'products',
          url: 'http://products.local',
          sdl: headSdl,
        })
        .then(r => r.expectNoGraphQLErrors());

      const result = await checkSchema(
        {
          service: 'products',
          baseline: {
            hash: 'baseline-with-removed-field',
            sdl: /* GraphQL */ `
              extend schema
                @link(url: "https://specs.apollo.dev/link/v1.0")
                @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

              type Query {
                product: Product
              }

              type Product @key(fields: "id") {
                id: ID!
                removedInHead: String
              }
            `,
          },
          sdl: headSdl,
        },
        token.secret,
      ).then(r => r.expectNoGraphQLErrors());

      expect(result.schemaCheck).toMatchObject({
        __typename: 'SchemaCheckError',
        valid: false,
        schemaCheck: {
          previousSchemaSDL: expect.stringContaining('removedInHead: String'),
          baseline: {
            sdl: expect.stringContaining('removedInHead: String'),
            supergraphSdl: expect.stringContaining('removedInHead'),
            publicSdl: expect.stringContaining('removedInHead'),
            compositionErrors: null,
            meta: {
              commit: 'baseline-with-removed-field',
            },
          },
        },
        changes: {
          nodes: [
            {
              criticality: 'Breaking',
              message: "Field 'removedInHead' was removed from object type 'Product'",
            },
          ],
          total: 1,
        },
      });
    },
  );

  test.concurrent(
    'reports no changes when the baseline and head match but differ from the registry',
    async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken } = await createProject(ProjectType.Federation);
      const token = await createTargetAccessToken({});

      await token
        .publishSchema({
          service: 'products',
          url: 'http://products.local',
          sdl: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

            type Query {
              product: Product
            }

            type Product @key(fields: "id") {
              id: ID!
              registryOnly: String
            }
          `,
        })
        .then(r => r.expectNoGraphQLErrors());

      const baselineAndHeadSdl = /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

        type Query {
          product: Product
        }

        type Product @key(fields: "id") {
          id: ID!
        }
      `;

      const result = await checkSchema(
        {
          service: 'products',
          baseline: {
            hash: 'baseline-matching-head',
            sdl: baselineAndHeadSdl,
          },
          sdl: baselineAndHeadSdl,
        },
        token.secret,
      ).then(r => r.expectNoGraphQLErrors());

      expect(result.schemaCheck).toMatchObject({
        __typename: 'SchemaCheckSuccess',
        valid: true,
        schemaCheck: {
          previousSchemaSDL: expect.not.stringContaining('registryOnly: String'),
          baseline: {
            meta: {
              commit: 'baseline-matching-head',
            },
          },
        },
        changes: {
          nodes: [],
          total: 0,
        },
      });
    },
  );

  test.concurrent(
    'skips when the baseline, head, and registry schema match',
    async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken } = await createProject(ProjectType.Federation);
      const token = await createTargetAccessToken({});

      const sdl = /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

        type Query {
          product: Product
        }

        type Product @key(fields: "id") {
          id: ID!
        }
      `;

      await token
        .publishSchema({
          service: 'products',
          url: 'http://products.local',
          sdl,
        })
        .then(r => r.expectNoGraphQLErrors());

      const result = await checkSchema(
        {
          service: 'products',
          baseline: {
            hash: 'baseline-matching-registry-and-head',
            sdl,
          },
          sdl,
        },
        token.secret,
      ).then(r => r.expectNoGraphQLErrors());

      expect(result.schemaCheck).toMatchObject({
        __typename: 'SchemaCheckSuccess',
        valid: true,
        schemaCheck: {
          previousSchemaSDL: expect.stringContaining('type Product'),
          baseline: {
            meta: {
              commit: 'baseline-matching-registry-and-head',
            },
          },
        },
        changes: {
          nodes: [],
          total: 0,
        },
      });
    },
  );

  test.concurrent(
    'compares the proposed schema against the provided baseline SDL',
    async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken } = await createProject(ProjectType.Federation);
      const token = await createTargetAccessToken({});

      await token
        .publishSchema({
          service: 'products',
          url: 'http://products.local',
          sdl: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

            type Query {
              product: Product
            }

            type Product @key(fields: "id") {
              id: ID!
              stable: String
              registryOnly: String
            }
          `,
        })
        .then(r => r.expectNoGraphQLErrors());

      await token
        .publishSchema({
          service: 'reviews',
          url: 'http://reviews.local',
          sdl: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

            type Query {
              review: String
            }
          `,
        })
        .then(r => r.expectNoGraphQLErrors());

      const result = await checkSchema(
        {
          service: 'products',
          baseline: {
            hash: 'baseline-commit-sha',
            sdl: /* GraphQL */ `
              extend schema
                @link(url: "https://specs.apollo.dev/link/v1.0")
                @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

              type Query {
                product: Product
              }

              type Product @key(fields: "id") {
                id: ID!
                stable: String
                baseOnly: String
              }
            `,
          },
          sdl: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

            type Query {
              product: Product
            }

            type Product @key(fields: "id") {
              id: ID!
              stable: String
            }
          `,
        },
        token.secret,
      ).then(r => r.expectNoGraphQLErrors());

      // registryOnly being removed does not show up!
      expect(result.schemaCheck).toMatchObject({
        __typename: 'SchemaCheckError',
        valid: false,
        schemaCheck: {
          previousSchemaSDL: expect.stringContaining('baseOnly: String'),
          baseline: {
            meta: {
              commit: 'baseline-commit-sha',
            },
          },
        },
        changes: {
          nodes: [
            {
              criticality: 'Breaking',
              message: "Field 'baseOnly' was removed from object type 'Product'",
            },
          ],
          total: 1,
        },
      });
    },
  );

  test.concurrent('fails when the provided baseline SDL cannot be composed', async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Federation);
    const token = await createTargetAccessToken({});

    await token
      .publishSchema({
        service: 'products',
        url: 'http://products.local',
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

          type Query {
            product: Product
          }

          type Product @key(fields: "id") {
            id: ID!
          }
        `,
      })
      .then(r => r.expectNoGraphQLErrors());

    const result = await checkSchema(
      {
        service: 'products',
        baseline: {
          hash: 'invalid-baseline-schema',
          sdl: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

            type Query {
              product: Product
            }

            type Product @key(fields: "missing") {
              id: ID!
            }
          `,
        },
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

          type Query {
            product: Product
          }

          type Product @key(fields: "id") {
            id: ID!
            name: String
          }
        `,
      },
      token.secret,
    ).then(r => r.expectNoGraphQLErrors());

    expect(result.schemaCheck).toMatchObject({
      __typename: 'SchemaCheckError',
      valid: false,
      errors: {
        nodes: [{ message: 'Baseline composition failed.' }],
        total: 1,
      },
      schemaCheck: {
        baseline: {
          sdl: expect.stringContaining('@key(fields: "missing")'),
          supergraphSdl: null,
          publicSdl: null,
          compositionErrors: expect.arrayContaining([
            {
              message: expect.any(String),
              path: null,
            },
          ]),
          meta: {
            commit: 'invalid-baseline-schema',
          },
        },
      },
    });
  });
});

test.concurrent(
  'checking an invalid schema fails due to validation errors (deprecated non-nullable input field)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Single);
    const token = await createTargetAccessToken({});

    const sdl = /* GraphQL */ `
      type Query {
        a(b: B!): String
      }

      input B {
        a: String! @deprecated(reason: "This field is deprecated")
        b: String!
      }
    `;

    const result = await token.checkSchema(sdl).then(r => r.expectNoGraphQLErrors());

    expect(result.schemaCheck).toEqual({
      __typename: 'SchemaCheckError',
      changes: {
        nodes: [],
        total: 0,
      },
      errors: {
        nodes: [
          {
            message: 'Required input field B.a cannot be deprecated.',
          },
        ],
        total: 1,
      },
      schemaCheck: {
        id: expect.any(String),
        baseline: {
          meta: {
            commit: null,
          },
          sdl: null,
          compositionErrors: null,
          supergraphSdl: null,
          publicSdl: null,
        },
        previousSchemaSDL: null,
      },
      valid: false,
    });
  },
);

function connectionString() {
  const {
    POSTGRES_USER = 'postgres',
    POSTGRES_PASSWORD = 'postgres',
    POSTGRES_HOST = 'localhost',
    POSTGRES_PORT = 5432,
    POSTGRES_DB = 'registry',
    POSTGRES_SSL = null,
    POSTGRES_CONNECTION_STRING = null,
  } = process.env;
  return (
    POSTGRES_CONNECTION_STRING ||
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}${
      POSTGRES_SSL ? '?sslmode=require' : '?sslmode=disable'
    }`
  );
}

test.concurrent(
  'checking a valid schema onto a broken schema succeeds (prior schema has deprecated non-nullable input)',
  async () => {
    const seed = initSeed();
    const { createOrg } = await seed.createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);
    const token = await createTargetAccessToken({});

    const brokenSdl = /* GraphQL */ `
      type Query {
        a(b: B!): String
      }

      input B {
        a: String! @deprecated(reason: "This field is deprecated")
        b: String!
      }
    `;

    // we need to manually insert a broken schema version into the database
    // as we fixed the issue that allows publishing such a broken version

    const conn = connectionString();
    const storage = await createStorage(conn, 2);
    const schemaVersions = new SchemaVersionStore(storage.pool);
    const graphStore = await seed.getGraphStore();
    const graph = await graphStore.findGraphForTargetIdByName(target.id, 'default');
    invariant(graph, 'Graph must exist.');
    await schemaVersions.createPublishSchemaVersion({
      schema: brokenSdl,
      author: 'Jochen',
      async actionFn() {},
      base_schema: null,
      commit: '123',
      changes: [],
      compositeSchemaSDL: null,
      conditionalBreakingChangeMetadata: null,
      contracts: null,
      diffSchemaVersionId: null,
      github: null,
      metadata: null,
      schemaRevisionId: null,
      revision: null,
      existingSchemaLogs: [],
      projectId: project.id,
      organizationId: organization.id,
      previousSchemaVersion: null,
      valid: true,
      schemaCompositionErrors: [],
      supergraphSDL: null,
      tags: null,
      targetId: target.id,
      serviceChanges: null,
      service: null,
      previousSchemaLogId: null,
      supergraphChanges: null,
      schemaMetadata: null,
      metadataAttributes: null,
      graph,
    });
    await storage.destroy();

    const sdl = /* GraphQL */ `
      type Query {
        a(b: B!): String
      }

      input B {
        a: String @deprecated(reason: "This field is deprecated")
        b: String!
      }
    `;

    const result = await token.checkSchema(sdl).then(r => r.expectNoGraphQLErrors());
    expect(result.schemaCheck).toMatchObject({
      __typename: 'SchemaCheckSuccess',
      changes: {
        nodes: [
          {
            criticality: 'Safe',
            message: "Input field 'B.a' changed type from 'String!' to 'String'",
          },
        ],
        total: 1,
      },
      schemaCheck: {
        id: expect.any(String),
      },
      valid: true,
    });
  },
);

test.concurrent('schema policy errors prevent schema check approval', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createTargetAccessToken, setProjectSchemaPolicy, project, target } = await createProject(
    ProjectType.Single,
  );

  await setProjectSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Error));

  const writeToken = await createTargetAccessToken({});
  await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
        }
      `,
    })
    .then(r => r.expectNoGraphQLErrors());

  const checkResult = await writeToken
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
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
        schemaCheckId,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(mutationResult).toEqual({
    approveFailedSchemaCheck: {
      ok: null,
      error: {
        message: 'Schema check has schema policy errors that must be resolved before approval.',
      },
    },
  });
});

test.concurrent(
  'schema policy errors prevent schema check approval with safe changes',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, setProjectSchemaPolicy, project, target } =
      await createProject(ProjectType.Single);

    await setProjectSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Error));

    const writeToken = await createTargetAccessToken({});
    await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
      })
      .then(r => r.expectNoGraphQLErrors());

    const checkResult = await writeToken
      .checkSchema(/* GraphQL */ `
        type Query {
          ping: String
          pong: String
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
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
          schemaCheckId,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(mutationResult).toEqual({
      approveFailedSchemaCheck: {
        ok: null,
        error: {
          message: 'Schema check has schema policy errors that must be resolved before approval.',
        },
      },
    });
  },
);

test.concurrent(
  'approve failed schema check with author field using target access token',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);
    const writeToken = await createTargetAccessToken({});

    const publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const readToken = await createTargetAccessToken({
      mode: 'readWrite',
    });

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
      document: graphql(/* GraphQL */ `
        mutation ApproveFailedSchemaCheckWithAuthor($input: ApproveFailedSchemaCheckInput!) {
          approveFailedSchemaCheck(input: $input) {
            ok {
              schemaCheck {
                __typename
                ... on SuccessfulSchemaCheck {
                  isApproved
                  approvalComment
                  cliApprovalMetadata {
                    displayName
                    email
                  }
                }
              }
            }
            error {
              message
            }
          }
        }
      `),
      variables: {
        input: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
          schemaCheckId,
          comment: 'Check force approved automatically via CLI --forceSafe flag',
          author: 'John Doe <john@example.com>',
        },
      },
      authToken: readToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(mutationResult.approveFailedSchemaCheck.ok).not.toBeNull();
    expect(mutationResult.approveFailedSchemaCheck.error).toBeNull();

    const approvedCheck = mutationResult.approveFailedSchemaCheck.ok?.schemaCheck;
    expect(approvedCheck?.__typename).toBe('SuccessfulSchemaCheck');

    if (approvedCheck?.__typename === 'SuccessfulSchemaCheck') {
      expect(approvedCheck.isApproved).toBe(true);

      expect(approvedCheck.cliApprovalMetadata).toMatchObject({
        displayName: 'John Doe',
        email: 'john@example.com',
      });
    }

    const schemaCheckQueryResult = await execute({
      document: graphql(/* GraphQL */ `
        query GetSchemaCheckWithApproval(
          $organizationSlug: String!
          $projectSlug: String!
          $targetSlug: String!
          $schemaCheckId: ID!
        ) {
          target(
            reference: {
              bySelector: {
                organizationSlug: $organizationSlug
                projectSlug: $projectSlug
                targetSlug: $targetSlug
              }
            }
          ) {
            schemaCheck(id: $schemaCheckId) {
              __typename
              ... on SuccessfulSchemaCheck {
                id
                isApproved
                cliApprovalMetadata {
                  displayName
                  email
                }
                breakingSchemaChanges {
                  nodes {
                    message
                    approval {
                      cliApprovalMetadata {
                        displayName
                        email
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `),
      variables: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
        schemaCheckId,
      },
      authToken: readToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    const queriedCheck = schemaCheckQueryResult.target?.schemaCheck;
    expect(queriedCheck?.__typename).toBe('SuccessfulSchemaCheck');

    if (queriedCheck?.__typename === 'SuccessfulSchemaCheck') {
      expect(queriedCheck.isApproved).toBe(true);

      const breakingChanges = queriedCheck.breakingSchemaChanges?.nodes ?? [];
      expect(breakingChanges.length).toBeGreaterThan(0);

      for (const change of breakingChanges) {
        expect(change.approval?.cliApprovalMetadata).toMatchObject({
          displayName: 'John Doe',
          email: 'john@example.com',
        });
      }
    }
  },
);

test.concurrent(
  'approve failed schema check handles different author formats',
  async ({ expect }) => {
    const testCases = [
      {
        author: 'john@example.com',
        expected: { displayName: 'john@example.com', email: 'john@example.com' },
        description: 'email only',
      },
      {
        author: 'John Doe',
        expected: { displayName: 'John Doe', email: '<no email provided>' },
        description: 'name only',
      },
      {
        author: 'John Doe <john@example.com>',
        expected: { displayName: 'John Doe', email: 'john@example.com' },
        description: 'git standard format',
      },
    ];

    for (const testCase of testCases) {
      const { createOrg } = await initSeed().createOwner();
      const { createProject, organization } = await createOrg();
      const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

      const writeToken = await createTargetAccessToken({
        mode: 'readWrite',
      });

      await writeToken
        .publishSchema({
          sdl: /* GraphQL */ `
            type Query {
              ping: String
              email: String
            }
          `,
        })
        .then(r => r.expectNoGraphQLErrors());

      const checkResult = await writeToken
        .checkSchema(/* GraphQL */ `
          type Query {
            ping: String
          }
        `)
        .then(r => r.expectNoGraphQLErrors());

      expect(checkResult.schemaCheck.__typename).toBe('SchemaCheckError');
      if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
        throw new Error('Expected SchemaCheckError');
      }

      const schemaCheckId = checkResult.schemaCheck.schemaCheck?.id;
      expect(schemaCheckId).toBeDefined();

      const mutationResult = await execute({
        document: graphql(/* GraphQL */ `
          mutation ApproveFailedSchemaCheckWithDifferentAuthorFormats(
            $input: ApproveFailedSchemaCheckInput!
          ) {
            approveFailedSchemaCheck(input: $input) {
              ok {
                schemaCheck {
                  __typename
                  ... on SuccessfulSchemaCheck {
                    isApproved
                    approvalComment
                    cliApprovalMetadata {
                      displayName
                      email
                    }
                  }
                }
              }
              error {
                message
              }
            }
          }
        `),
        variables: {
          input: {
            organizationSlug: organization.slug,
            projectSlug: project.slug,
            targetSlug: target.slug,
            schemaCheckId: schemaCheckId!,
            comment: `Testing ${testCase.description}`,
            author: testCase.author,
          },
        },
        authToken: writeToken.secret,
      }).then(r => r.expectNoGraphQLErrors());

      expect(mutationResult.approveFailedSchemaCheck.ok).not.toBeNull();

      const approvedCheck = mutationResult.approveFailedSchemaCheck.ok?.schemaCheck;
      if (approvedCheck?.__typename === 'SuccessfulSchemaCheck') {
        expect(approvedCheck.cliApprovalMetadata?.displayName).toBe(testCase.expected.displayName);
        expect(approvedCheck.cliApprovalMetadata?.email).toBe(testCase.expected.email);
      }
    }
  },
);

const SchemaChecksQuery = graphql(/* GraphQL */ `
  query SchemaChecksOnTargetQuery($selector: TargetSelectorInput!, $filters: SchemaChecksFilter) {
    target(reference: { bySelector: $selector }) {
      schemaChecks(first: 10, filters: $filters) {
        edges {
          node {
            id
            serviceName
          }
        }
      }
    }
  }
`);

test.concurrent('schema checks can be filtered by service name', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createTargetAccessToken, project, target } = await createProject(ProjectType.Federation);
  const token = await createTargetAccessToken({});

  const checkIds: string[] = [];
  for (const [sdl, service] of [
    ['type Query { users: [String!]! }', 'users'],
    ['type Query { products: [String!]! }', 'products'],
    ['type Query { users: [String!]! me: String }', 'users'],
  ] as const) {
    const result = await token.checkSchema(sdl, service).then(r => r.expectNoGraphQLErrors());
    if (result.schemaCheck.__typename !== 'SchemaCheckSuccess' || !result.schemaCheck.schemaCheck) {
      throw new Error(`Expected SchemaCheckSuccess, got ${result.schemaCheck.__typename}`);
    }
    checkIds.push(result.schemaCheck.schemaCheck.id);
  }
  const [firstUsers, products, secondUsers] = checkIds;

  const schemaChecks = (filters: { serviceName?: string } | null) =>
    execute({
      document: SchemaChecksQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        filters,
      },
      authToken: ownerToken,
    })
      .then(r => r.expectNoGraphQLErrors())
      .then(r => r.target?.schemaChecks.edges.map(edge => edge.node));

  await expect(schemaChecks({ serviceName: 'users' })).resolves.toEqual([
    { id: secondUsers, serviceName: 'users' },
    { id: firstUsers, serviceName: 'users' },
  ]);
  // The filter is lowercased like the service name was on write.
  await expect(schemaChecks({ serviceName: 'Users' })).resolves.toEqual([
    { id: secondUsers, serviceName: 'users' },
    { id: firstUsers, serviceName: 'users' },
  ]);
  await expect(schemaChecks({ serviceName: 'products' })).resolves.toEqual([
    { id: products, serviceName: 'products' },
  ]);
  await expect(schemaChecks(null)).resolves.toEqual([
    { id: secondUsers, serviceName: 'users' },
    { id: products, serviceName: 'products' },
    { id: firstUsers, serviceName: 'users' },
  ]);
});

const SchemaCheckChangePagesQuery = graphql(/* GraphQL */ `
  query SchemaCheckChangePagesQuery(
    $selector: TargetSelectorInput!
    $id: ID!
    $first: Int
    $offset: Int
  ) {
    target(reference: { bySelector: $selector }) {
      schemaCheck(id: $id) {
        __typename
        unapprovedBreakingSchemaChangeCount
        allBreaking: breakingSchemaChanges {
          totalCount
          edges {
            node {
              message
            }
          }
        }
        breakingPage: breakingSchemaChanges(first: $first, offset: $offset) {
          totalCount
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              message
              kind
            }
          }
        }
        safeSchemaChangeGroups {
          kind
          totalCount
          changes(first: 2) {
            totalCount
            pageInfo {
              hasNextPage
            }
            edges {
              node {
                message
                kind
              }
            }
          }
        }
        typeAdded: safeSchemaChangeGroups(kind: TYPE_ADDED) {
          kind
        }
      }
    }
  }
`);

test.concurrent(
  'breaking changes page by offset and safe changes group by kind',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);
    const writeToken = await createTargetAccessToken({});

    const removed = Array.from({ length: 60 }, (_, index) => `  f${index}: String`).join('\n');
    const publishResult = await writeToken
      .publishSchema({
        sdl: `"""Old"""\ntype Query {\n  keep: String\n${removed}\n}`,
      })
      .then(r => r.expectNoGraphQLErrors());
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Drops 60 fields (breaking), rewrites one description and adds three types, each reachable
    // through a new field: one TYPE_DESCRIPTION_CHANGED, three FIELD_ADDED and three TYPE_ADDED.
    const checkResult = await writeToken
      .checkSchema(
        `"""New"""\ntype Query {\n  keep: String\n  a: A\n  b: B\n  c: C\n}\ntype A { id: ID }\ntype B { id: ID }\ntype C { id: ID }`,
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

    const read = (variables: { first?: number; offset?: number }) =>
      execute({
        document: SchemaCheckChangePagesQuery,
        variables: {
          selector: {
            organizationSlug: organization.slug,
            projectSlug: project.slug,
            targetSlug: target.slug,
          },
          id: schemaCheckId,
          ...variables,
        },
        authToken: ownerToken,
      })
        .then(r => r.expectNoGraphQLErrors())
        .then(r => r.target!.schemaCheck!);

    const lastPage = await read({ first: 50, offset: 50 });
    const allIds = lastPage.allBreaking!.edges.map(edge => edge.node.message);

    expect(lastPage.__typename).toBe('FailedSchemaCheck');
    expect(lastPage.unapprovedBreakingSchemaChangeCount).toBe(60);
    // No paging arguments still returns every change.
    expect(lastPage.allBreaking!.totalCount).toBe(60);
    expect(allIds).toHaveLength(60);
    expect(lastPage.breakingPage).toMatchObject({
      totalCount: 60,
      pageInfo: { hasNextPage: false, hasPreviousPage: true },
    });
    expect(lastPage.breakingPage!.edges.map(edge => edge.node.message)).toEqual(allIds.slice(50));

    const firstPage = await read({ first: 50, offset: 0 });
    expect(firstPage.breakingPage!.pageInfo).toEqual({
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(firstPage.breakingPage!.edges.map(edge => edge.node.message)).toEqual(
      allIds.slice(0, 50),
    );

    const pastTheEnd = await read({ first: 50, offset: 100 });
    expect(pastTheEnd.breakingPage!.edges).toEqual([]);

    expect(
      firstPage.safeSchemaChangeGroups.map(group => ({
        kind: group.kind,
        totalCount: group.totalCount,
        pageSize: group.changes.edges.length,
        hasNextPage: group.changes.pageInfo.hasNextPage,
      })),
    ).toEqual([
      { kind: 'TYPE_DESCRIPTION_CHANGED', totalCount: 1, pageSize: 1, hasNextPage: false },
      { kind: 'FIELD_ADDED', totalCount: 3, pageSize: 2, hasNextPage: true },
      { kind: 'TYPE_ADDED', totalCount: 3, pageSize: 2, hasNextPage: true },
    ]);
    expect(firstPage.typeAdded).toEqual([{ kind: 'TYPE_ADDED' }]);
    // Each change names its own kind, the same value its group is keyed by.
    expect(new Set(firstPage.breakingPage!.edges.map(edge => edge.node.kind))).toEqual(
      new Set(['FIELD_REMOVED']),
    );
    for (const group of firstPage.safeSchemaChangeGroups) {
      for (const edge of group.changes.edges) {
        expect(edge.node.kind).toBe(group.kind);
      }
    }
  },
);

const SchemaCheckFlagsQuery = graphql(/* GraphQL */ `
  query SchemaCheckFlagsOnTargetQuery($selector: TargetSelectorInput!) {
    target(reference: { bySelector: $selector }) {
      schemaChecks(first: 10) {
        edges {
          node {
            __typename
            hasSchemaChanges
            hasUnapprovedBreakingChanges
          }
        }
      }
    }
  }
`);

test.concurrent(
  'schema checks list whether they changed the schema and have unapproved breaking changes',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);
    const token = await createTargetAccessToken({});

    await token
      .publishSchema({ sdl: 'type Query { ping: String }', author: 'User', commit: 'initial' })
      .then(r => r.expectNoGraphQLErrors());
    for (const sdl of [
      'type Query { ping: Float }',
      'type Query { ping: String pong: String }',
      'type Query { ping: String }',
    ]) {
      await token.checkSchema(sdl).then(r => r.expectNoGraphQLErrors());
    }

    const flags = execute({
      document: SchemaCheckFlagsQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
      },
      authToken: ownerToken,
    })
      .then(r => r.expectNoGraphQLErrors())
      .then(r => r.target?.schemaChecks.edges.map(edge => edge.node));

    await expect(flags).resolves.toEqual([
      {
        __typename: 'SuccessfulSchemaCheck',
        hasSchemaChanges: false,
        hasUnapprovedBreakingChanges: false,
      },
      {
        __typename: 'SuccessfulSchemaCheck',
        hasSchemaChanges: true,
        hasUnapprovedBreakingChanges: false,
      },
      {
        __typename: 'FailedSchemaCheck',
        hasSchemaChanges: true,
        hasUnapprovedBreakingChanges: true,
      },
    ]);
  },
);
const SchemaCheckServiceNamesQuery = graphql(/* GraphQL */ `
  query SchemaCheckServiceNamesQuery($selector: TargetSelectorInput!) {
    target(reference: { bySelector: $selector }) {
      schemaCheckServiceNames
    }
  }
`);

test.concurrent(
  'schemaCheckServiceNames lists the checked services, deduplicated and sorted',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(
      ProjectType.Federation,
    );
    const token = await createTargetAccessToken({});

    // Published but never checked, so it must not be listed.
    const publishResult = await token
      .publishSchema({
        service: 'inventory',
        url: 'https://api.com/inventory',
        sdl: 'type Query { stock: Int }',
      })
      .then(r => r.expectNoGraphQLErrors());
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    for (const [sdl, service] of [
      ['type Query { users: [String!]! }', 'users'],
      ['type Query { products: [String!]! }', 'Products'],
      ['type Query { users: [String!]! me: String }', 'users'],
      ['type Query { accounts: [String!]! }', 'accounts'],
    ] as const) {
      await token.checkSchema(sdl, service).then(r => r.expectNoGraphQLErrors());
    }

    // A new service whose first check fails composition is listed too.
    const failedCheck = await token
      .checkSchema('type Query { stock: String }', 'reviews')
      .then(r => r.expectNoGraphQLErrors());
    expect(failedCheck.schemaCheck.__typename).toBe('SchemaCheckError');

    const result = await execute({
      document: SchemaCheckServiceNamesQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.target?.schemaCheckServiceNames).toEqual([
      'accounts',
      'products',
      'reviews',
      'users',
    ]);
  },
);

test.concurrent(
  'schemaCheckServiceNames is null for a single-schema project',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);
    const token = await createTargetAccessToken({});

    await token.checkSchema('type Query { ping: String }').then(r => r.expectNoGraphQLErrors());

    const result = await execute({
      document: SchemaCheckServiceNamesQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.target?.schemaCheckServiceNames).toBeNull();
  },
);
