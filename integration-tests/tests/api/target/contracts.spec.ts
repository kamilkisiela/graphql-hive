import { graphql } from 'testkit/gql';
import { ProjectType } from 'testkit/gql/graphql';
import { execute } from 'testkit/graphql';
import { initSeed } from 'testkit/seed';

const CreateContractMutation = graphql(`
  mutation CreateContractMutation($input: CreateContractInput!) {
    createContract(input: $input) {
      ok {
        createdContract {
          id
          contractName
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
          target
          contractName
          includeTags
          excludeTags
        }
      }
    }
  }
`);

test.concurrent('create contract for Federation project', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'toyota',
        includeTags: ['foo'],
        excludeTags: ['bar'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
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
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { target } = await createProject(ProjectType.Federation);

    const result = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          target: { byId: target.id },
          contractName: 'toyota',
          includeTags: ['foo'],
          excludeTags: ['foo'],
          removeUnreachableTypesFromPublicApiSchema: true,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result).toMatchInlineSnapshot(`
    {
      createContract: {
        error: {
          details: {
            contractName: null,
            excludeTags: null,
            includeTags: Included and exclude tags must not intersect,
            target: null,
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
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'toyota',
        includeTags: [],
        excludeTags: [],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result).toMatchInlineSnapshot(`
    {
      createContract: {
        error: {
          details: {
            contractName: null,
            excludeTags: null,
            includeTags: Provide at least one value for either included tags or excluded tags,
            target: null,
          },
          message: Something went wrong.,
        },
        ok: null,
      },
    }
  `);
});

test.concurrent('includeTags only', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'toyota',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
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
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'toyota',
        excludeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
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

test.concurrent('conflicting contractName results in error', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  let result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'toyota',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'toyota',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result).toMatchInlineSnapshot(`
    {
      createContract: {
        error: {
          details: {
            contractName: Must be unique across all target contracts.,
            excludeTags: null,
            includeTags: null,
            target: null,
          },
          message: Something went wrong.,
        },
        ok: null,
      },
    }
  `);
});

test.concurrent('contractName must be at least 2 characters long', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 't',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());
  expect(result).toMatchInlineSnapshot(`
      {
        createContract: {
          error: {
            details: {
              contractName: String must contain at least 2 character(s),
              excludeTags: null,
              includeTags: null,
              target: null,
            },
            message: Something went wrong.,
          },
          ok: null,
        },
      }
    `);
});

test.concurrent('contractName must be at most 64 characters long', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: new Array(64 + 1).fill('a').join(''),
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());
  expect(result).toMatchInlineSnapshot(`
      {
        createContract: {
          error: {
            details: {
              contractName: String must contain at most 64 character(s),
              excludeTags: null,
              includeTags: null,
              target: null,
            },
            message: Something went wrong.,
          },
          ok: null,
        },
      }
  `);
});

test.concurrent('contractName must not contain non-alphanumeric characters', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'invalid name!',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result.createContract).toMatchObject({
    error: {
      details: {
        contractName: "Can only contain letters, numbers, '_', and '-'",
      },
    },
    ok: null,
  });
});

test.concurrent('contractName is lowercased', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'My_CONTRACT-1',
        includeTags: ['foo'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result.createContract.ok?.createdContract.contractName).toBe('my_contract-1');
});
