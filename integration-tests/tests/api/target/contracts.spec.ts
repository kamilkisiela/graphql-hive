import { execute } from 'testkit/graphql';
import { initSeed } from 'testkit/seed';
import { graphql } from '@app/gql';
import { ProjectType, TargetAccessScope } from '@app/gql/graphql';

const CreateContractMutation = graphql(`
  mutation CreateContractMutation($input: CreateContractInput!) {
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
          userSpecifiedContractId
          includeTags
          excludeTags
        }
      }
    }
  }
`);

test.concurrent('create contract for Federation project', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken, target } = await createProject(ProjectType.Federation);
  const token = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        userSpecifiedContractId: 'toyota',
        includeTags: ['foo'],
        excludeTags: ['bar'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: token.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result).toMatchObject({
    createContract: {
      error: null,
      ok: {
        createdContract: {
          createdAt: expect.any(String),
          excludeTags: ['bar'],
          id: expect.any(String),
          includeTags: ['foo'],
          target: {
            id: expect.any(String),
          },
        },
      },
    },
  });
});

test.concurrent(
  'intersection of includeTags and excludeTags results in error',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken, target } = await createProject(ProjectType.Federation);
    const token = await createToken({
      targetScopes: [
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const result = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          userSpecifiedContractId: 'toyota',
          includeTags: ['foo'],
          excludeTags: ['foo'],
          removeUnreachableTypesFromPublicApiSchema: true,
        },
      },
      authToken: token.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result).toMatchInlineSnapshot(`
    {
      createContract: {
        error: {
          details: {
            excludeTags: null,
            includeTags: Included and exclude tags must not intersect,
            targetId: null,
            userSpecifiedContractId: null,
          },
          message: Something went wrong.,
        },
        ok: null,
      },
    }
  `);
  },
);

test.concurrent('tags can not be empty', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken, target } = await createProject(ProjectType.Federation);
  const token = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        userSpecifiedContractId: 'toyota',
        includeTags: [],
        excludeTags: [],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: token.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result).toMatchInlineSnapshot(`
    {
      createContract: {
        error: {
          details: {
            excludeTags: null,
            includeTags: Provide at least one value for each,
            targetId: null,
            userSpecifiedContractId: null,
          },
          message: Something went wrong.,
        },
        ok: null,
      },
    }
  `);
});

test.concurrent('includeTags only', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken, target } = await createProject(ProjectType.Federation);
  const token = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        userSpecifiedContractId: 'toyota',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: token.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result).toMatchObject({
    createContract: {
      error: null,
      ok: {
        createdContract: {
          createdAt: expect.any(String),
          excludeTags: null,
          id: expect.any(String),
          includeTags: ['foo'],
          target: {
            id: expect.any(String),
          },
        },
      },
    },
  });
});

test.concurrent('exclude tags only', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken, target } = await createProject(ProjectType.Federation);
  const token = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        userSpecifiedContractId: 'toyota',
        excludeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: token.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result).toMatchObject({
    createContract: {
      error: null,
      ok: {
        createdContract: {
          createdAt: expect.any(String),
          excludeTags: ['foo'],
          id: expect.any(String),
          includeTags: null,
          target: {
            id: expect.any(String),
          },
        },
      },
    },
  });
});

test.concurrent('conflicting userSpecifiedContractId results in error', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken, target } = await createProject(ProjectType.Federation);
  const token = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  let result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        userSpecifiedContractId: 'toyota',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: token.secret,
  }).then(r => r.expectNoGraphQLErrors());

  result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        userSpecifiedContractId: 'toyota',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: token.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result).toMatchInlineSnapshot(`
    {
      createContract: {
        error: {
          details: {
            excludeTags: null,
            includeTags: null,
            targetId: null,
            userSpecifiedContractId: Must be unique across all target contracts.,
          },
          message: Something went wrong.,
        },
        ok: null,
      },
    }
  `);
});

test.concurrent(
  'userSpecifiedContractId must be at least 2 characters long',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken, target } = await createProject(ProjectType.Federation);
    const token = await createToken({
      targetScopes: [
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const result = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          userSpecifiedContractId: 't',
          includeTags: ['foo'],
          removeUnreachableTypesFromPublicApiSchema: true,
        },
      },
      authToken: token.secret,
    }).then(r => r.expectNoGraphQLErrors());
    expect(result).toMatchInlineSnapshot(`
      {
        createContract: {
          error: {
            details: {
              excludeTags: null,
              includeTags: null,
              targetId: null,
              userSpecifiedContractId: String must contain at least 2 character(s),
            },
            message: Something went wrong.,
          },
          ok: null,
        },
      }
    `);
  },
);

test.concurrent(
  'userSpecifiedContractId must be at most 64 characters long',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken, target } = await createProject(ProjectType.Federation);
    const token = await createToken({
      targetScopes: [
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const result = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          userSpecifiedContractId: new Array(64 + 1).fill('a').join(''),
          includeTags: ['foo'],
          removeUnreachableTypesFromPublicApiSchema: true,
        },
      },
      authToken: token.secret,
    }).then(r => r.expectNoGraphQLErrors());
    expect(result).toMatchInlineSnapshot(`
      {
        createContract: {
          error: {
            details: {
              excludeTags: null,
              includeTags: null,
              targetId: null,
              userSpecifiedContractId: String must contain at most 64 character(s),
            },
            message: Something went wrong.,
          },
          ok: null,
        },
      }
    `);
  },
);
