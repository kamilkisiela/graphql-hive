import { initSeed } from 'testkit/seed';
import { graphql } from '../../testkit/gql';
import { TargetAccessScope } from '../../testkit/gql/graphql';
import { execute } from '../../testkit/graphql';

const CreateAppDeployment = graphql(`
  mutation CreateAppDeployment($input: CreateAppDeploymentInput!) {
    createAppDeployment(input: $input) {
      error {
        message
        details {
          appName
          appVersion
        }
      }
      ok {
        createdAppDeployment {
          id
          name
          version
          status
        }
      }
    }
  }
`);

const AddDocumentsToAppDeployment = graphql(`
  mutation AddDocumentsToAppDeployment($input: AddDocumentsToAppDeploymentInput!) {
    addDocumentsToAppDeployment(input: $input) {
      error {
        message
        details {
          index
          message
        }
      }

      ok {
        appDeployment {
          id
          name
          version
          status
        }
      }
    }
  }
`);

const ActivateAppDeployment = graphql(`
  mutation ActivateAppDeployment($input: ActivateAppDeploymentInput!) {
    activateAppDeployment(input: $input) {
      error {
        message
      }
      ok {
        activatedAppDeployment {
          id
          name
          version
          status
        }
      }
    }
  }
`);

const RetireAppDeployment = graphql(`
  mutation RetireAppDeployment($input: RetireAppDeploymentInput!) {
    retireAppDeployment(input: $input) {
      error {
        message
      }

      ok {
        retiredAppDeployment {
          id
          name
          version
          status
        }
      }
    }
  }
`);

test('create app deployment, add operations, publish, access via CDN (happy path)', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const cdnAccess = await token.createCdnAccess();

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'hash',
            body: 'query { hello }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(addDocumentsToAppDeployment).toEqual({
    error: null,
    ok: {
      appDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  const { activateAppDeployment } = await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(activateAppDeployment).toEqual({
    error: null,
    ok: {
      activatedAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'active',
      },
    },
  });

  const persistedOperationUrl = `${cdnAccess.cdnUrl}/apps/my-app/1.0.0/hash`;
  const response = await fetch(persistedOperationUrl, {
    method: 'GET',
    headers: {
      'X-Hive-CDN-Key': cdnAccess.secretAccessToken,
    },
  });
  const txt = await response.text();
  expect(txt).toEqual('query { hello }');
  expect(response.status).toBe(200);
});

test('create app deployment with same name and version succeed if deployment is not active', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  let createAppDeployment = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  })
    .then(res => res.expectNoGraphQLErrors())
    .then(res => res.createAppDeployment);

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  createAppDeployment = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  })
    .then(res => res.expectNoGraphQLErrors())
    .then(res => res.createAppDeployment);

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });
});

test('create app deployment with same name and version does not fail if deployment is active', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  let createAppDeployment = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  })
    .then(res => res.expectNoGraphQLErrors())
    .then(res => res.createAppDeployment);

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  const { activateAppDeployment } = await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(activateAppDeployment).toEqual({
    error: null,
    ok: {
      activatedAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'active',
      },
    },
  });

  createAppDeployment = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  })
    .then(res => res.expectNoGraphQLErrors())
    .then(res => res.createAppDeployment);

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'active',
      },
    },
  });
});

test('create app deployment fails if app name is empty', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: '',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: {
      details: {
        appName: 'Must be at least 1 character long',
        appVersion: null,
      },
      message: 'Invalid input',
    },
    ok: null,
  });
});

test('create app deployment fails if app name exceeds length of 256 characters', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: new Array(257).fill('a').join(''),
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: {
      details: {
        appName: 'Must be at most 256 characters long',
        appVersion: null,
      },
      message: 'Invalid input',
    },
    ok: null,
  });
});

test('create app deployment fails if app version is empty', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'myapp',
        appVersion: '',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: {
      details: {
        appName: null,
        appVersion: 'Must be at least 1 character long',
      },
      message: 'Invalid input',
    },
    ok: null,
  });
});

test('create app deployment fails if app version exceeds length of 256 characters', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: new Array(257).fill('a').join(''),
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: {
      details: {
        appName: null,
        appVersion: 'Must be at most 256 characters long',
      },
      message: 'Invalid input',
    },
    ok: null,
  });
});

test('create app deployment fails without feature flag enabled for organization', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: {
      details: null,
      message:
        'This organization has no access to app deployments. Please contact the Hive team for early access.',
    },
    ok: null,
  });
});

test('add documents to app deployment fails if there is no initial schema published', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'hash',
            body: 'query { hello }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(addDocumentsToAppDeployment).toEqual({
    error: {
      details: null,
      message: 'No schema has been published yet',
    },
    ok: null,
  });
});

test('add documents to app deployment fails if document hash is shorter than 3 characters', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'sh',
            body: 'query { hello }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(addDocumentsToAppDeployment).toEqual({
    error: {
      details: {
        index: 0,
        message: 'Hash must be at least 3 characters long',
      },
      message: 'Invalid input, please check the operations.',
    },
    ok: null,
  });
});

test('add documents to app deployment fails if document hash is longer than 256 characters', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: new Array(257).fill('a').join(''),
            body: 'query { hello }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(addDocumentsToAppDeployment).toEqual({
    error: {
      details: {
        index: 0,
        message: 'Hash must be at most 256 characters long',
      },
      message: 'Invalid input, please check the operations.',
    },
    ok: null,
  });
});

test('add documents to app deployment fails if document is not parse-able', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'hash',
            body: 'qugu',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(addDocumentsToAppDeployment).toEqual({
    error: {
      details: {
        index: 0,
        message: 'Syntax Error: Unexpected Name "qugu".',
      },
      message: 'Failed to parse a GraphQL operation.',
    },
    ok: null,
  });
});

test('add documents to app deployment fails if document does not pass validation against the target schema', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(createAppDeployment).toEqual({
    error: null,
    ok: {
      createdAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        version: '1.0.0',
        status: 'pending',
      },
    },
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'hash',
            body: 'query { hi }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(addDocumentsToAppDeployment).toEqual({
    error: {
      details: {
        index: 0,
        message: 'Cannot query field "hi" on type "Query".',
      },
      message: 'Failed to validate GraphQL operation against schema.',
    },
    ok: null,
  });
});

test('add documents to app deployment fails if app deployment does not exist', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'hash',
            body: 'query { hello }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(addDocumentsToAppDeployment).toEqual({
    error: {
      details: null,
      message: 'App deployment not found',
    },
    ok: null,
  });
});

test('add documents to app deployment fails without feature flag enabled for organization', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'hash',
            body: 'query { hello }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(addDocumentsToAppDeployment).toEqual({
    error: {
      details: null,
      message:
        'This organization has no access to app deployments. Please contact the Hive team for early access.',
    },
    ok: null,
  });
});

test('activate app deployment fails if app deployment does not exist', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { activateAppDeployment } = await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(activateAppDeployment).toEqual({
    error: {
      message: 'App deployment not found',
    },
    ok: null,
  });
});

test('retire app deployment fails if app deployment does not exist', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken, target } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { retireAppDeployment } = await execute({
    document: RetireAppDeployment,
    variables: {
      input: {
        targetId: target.id,
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(retireAppDeployment).toEqual({
    error: {
      message: 'App deployment not found',
    },
    ok: null,
  });
});

test('retire app deployment fails if app deployment is pending (not active)', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken, target } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  const { retireAppDeployment } = await execute({
    document: RetireAppDeployment,
    variables: {
      input: {
        targetId: target.id,
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(retireAppDeployment).toEqual({
    error: {
      message: 'App deployment is not active',
    },
    ok: null,
  });
});

test('retire app deployment succeeds if app deployment is active', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken, target } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  const { retireAppDeployment } = await execute({
    document: RetireAppDeployment,
    variables: {
      input: {
        targetId: target.id,
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(retireAppDeployment).toEqual({
    error: null,
    ok: {
      retiredAppDeployment: {
        id: expect.any(String),
        name: 'my-app',
        status: 'active',
        version: '1.0.0',
      },
    },
  });
});

test('retire app deployments makes the persisted operations unavailable via CDN', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken, target } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const cdnAccess = await token.createCdnAccess();

  await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'hash',
            body: 'query { hello }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  const persistedOperationUrl = `${cdnAccess.cdnUrl}/apps/my-app/1.0.0/hash`;
  let response = await fetch(persistedOperationUrl, {
    method: 'GET',
    headers: {
      'X-Hive-CDN-Key': cdnAccess.secretAccessToken,
    },
  });

  expect(response.status).toBe(200);

  await execute({
    document: RetireAppDeployment,
    variables: {
      input: {
        targetId: target.id,
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  response = await fetch(persistedOperationUrl, {
    method: 'GET',
    headers: {
      'X-Hive-CDN-Key': cdnAccess.secretAccessToken,
    },
  });

  expect(response.status).toBe(404);
});

test('retire app deployments fails without feature flag enabled for organization', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken, target } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { retireAppDeployment } = await execute({
    document: RetireAppDeployment,
    variables: {
      input: {
        targetId: target.id,
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(retireAppDeployment).toEqual({
    error: {
      message:
        'This organization has no access to app deployments. Please contact the Hive team for early access.',
    },
    ok: null,
  });
});
