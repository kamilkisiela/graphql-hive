import { buildASTSchema, parse } from 'graphql';
import { createLogger } from 'graphql-yoga';
import { waitFor } from 'testkit/flow';
import { initSeed } from 'testkit/seed';
import { getServiceHost } from 'testkit/utils';
import { createHive } from '@graphql-hive/core';
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

const GetAppDeployment = graphql(`
  query GetAppDeployment(
    $targetSelector: TargetSelectorInput!
    $appDeploymentName: String!
    $appDeploymentVersion: String!
  ) {
    target(selector: $targetSelector) {
      appDeployment(appName: $appDeploymentName, appVersion: $appDeploymentVersion) {
        id
        lastUsed
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
        isSkipped
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

const GetPaginatedPersistedDocuments = graphql(`
  query GetPaginatedPersistedDocuments(
    $targetSelector: TargetSelectorInput!
    $appDeploymentName: String!
    $appDeploymentVersion: String!
    $first: Int
    $cursor: String
  ) {
    target(selector: $targetSelector) {
      appDeployment(appName: $appDeploymentName, appVersion: $appDeploymentVersion) {
        id
        documents(first: $first, after: $cursor) {
          edges {
            cursor
            node {
              hash
              body
            }
          }
          pageInfo {
            hasNextPage
          }
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
      isSkipped: false,
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
      isSkipped: false,
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
        appName: 'Must be at most 64 characters long',
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
        appVersion: 'Must be at most 64 characters long',
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

test('add documents to app deployment fails if document hash is less than 1 character', async () => {
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
            hash: '',
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
        message: 'Hash must be at least 1 characters long',
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
            hash: new Array(129).fill('a').join(''),
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
        message: 'Hash must be at most 128 characters long',
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
      message: 'The GraphQL operation is not valid against the latest schema version.',
    },
    ok: null,
  });
});

test('add documents to app deployment fails if document contains multiple executable operation definitions', async () => {
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
            body: 'query a { hello } query b { hello }',
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
        message:
          'Multiple operation definitions found. Only one executable operation definition is allowed per document.',
      },
      message: 'Only one executable operation definition is allowed per document.',
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

test('activate app deployment succeeds if app deployment is already active', async () => {
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

  let activateResult = await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(activateResult).toEqual({
    activateAppDeployment: {
      error: null,
      ok: {
        activatedAppDeployment: {
          id: expect.any(String),
          name: 'my-app',
          status: 'active',
          version: '1.0.0',
        },
        isSkipped: false,
      },
    },
  });

  activateResult = await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(activateResult).toEqual({
    activateAppDeployment: {
      error: null,
      ok: {
        activatedAppDeployment: {
          id: expect.any(String),
          name: 'my-app',
          status: 'active',
          version: '1.0.0',
        },
        isSkipped: true,
      },
    },
  });
});

test('activate app deployment fails if app deployment is retired', async () => {
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

  let activateResult = await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(activateResult).toEqual({
    activateAppDeployment: {
      error: null,
      ok: {
        activatedAppDeployment: {
          id: expect.any(String),
          name: 'my-app',
          status: 'active',
          version: '1.0.0',
        },
        isSkipped: false,
      },
    },
  });

  const retireResult = await execute({
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
  expect(retireResult).toEqual({
    retireAppDeployment: {
      error: null,
      ok: {
        retiredAppDeployment: {
          id: expect.any(String),
          name: 'my-app',
          status: 'active',
          version: '1.0.0',
        },
      },
    },
  });

  activateResult = await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'my-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(activateResult).toEqual({
    activateAppDeployment: {
      error: {
        message: 'App deployment is retired',
      },
      ok: null,
    },
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

test('get app deployment documents via GraphQL API', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken, project, target } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: 'app-version',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(createAppDeployment.error).toBeNull();

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        a: String
        b: String
        c: String
        d: String
      }
    `,
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: 'app-version',
        documents: [
          {
            hash: 'aaa',
            body: 'query { a }',
          },
          {
            hash: 'bbb',
            body: 'query { b }',
          },
          {
            hash: 'ccc',
            body: 'query { c }',
          },
          {
            hash: 'ddd',
            body: 'query { d }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(addDocumentsToAppDeployment.error).toBeNull();

  const result = await execute({
    document: GetPaginatedPersistedDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'app-name',
      appDeploymentVersion: 'app-version',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(result.target).toMatchObject({
    appDeployment: {
      documents: {
        edges: [
          {
            cursor: 'YWFh',
            node: {
              body: 'query { a }',
              hash: 'aaa',
            },
          },
          {
            cursor: 'YmJi',
            node: {
              body: 'query { b }',
              hash: 'bbb',
            },
          },
          {
            cursor: 'Y2Nj',
            node: {
              body: 'query { c }',
              hash: 'ccc',
            },
          },
          {
            cursor: 'ZGRk',
            node: {
              body: 'query { d }',
              hash: 'ddd',
            },
          },
        ],
        pageInfo: {
          hasNextPage: false,
        },
      },
      id: expect.any(String),
    },
  });
});

test('paginate app deployment documents via GraphQL API', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken, project, target } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: 'app-version',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(createAppDeployment.error).toBeNull();

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        a: String
        b: String
        c: String
        d: String
      }
    `,
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: 'app-version',
        documents: [
          {
            hash: 'aaa',
            body: 'query { a }',
          },
          {
            hash: 'bbb',
            body: 'query { b }',
          },
          {
            hash: 'ccc',
            body: 'query { c }',
          },
          {
            hash: 'ddd',
            body: 'query { d }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(addDocumentsToAppDeployment.error).toBeNull();

  let result = await execute({
    document: GetPaginatedPersistedDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'app-name',
      appDeploymentVersion: 'app-version',
      first: 1,
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(result.target).toMatchObject({
    appDeployment: {
      documents: {
        edges: [
          {
            cursor: 'YWFh',
            node: {
              body: 'query { a }',
              hash: 'aaa',
            },
          },
        ],
        pageInfo: {
          hasNextPage: true,
        },
      },
      id: expect.any(String),
    },
  });
  result = await execute({
    document: GetPaginatedPersistedDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'app-name',
      appDeploymentVersion: 'app-version',
      first: 1,
      cursor: 'YWFh',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(result.target).toMatchObject({
    appDeployment: {
      documents: {
        edges: [
          {
            cursor: 'YmJi',
            node: {
              body: 'query { b }',
              hash: 'bbb',
            },
          },
        ],
        pageInfo: {
          hasNextPage: true,
        },
      },
      id: expect.any(String),
    },
  });
  result = await execute({
    document: GetPaginatedPersistedDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'app-name',
      appDeploymentVersion: 'app-version',
      cursor: 'YmJi',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(result.target).toMatchObject({
    appDeployment: {
      documents: {
        edges: [
          {
            cursor: 'Y2Nj',
            node: {
              body: 'query { c }',
              hash: 'ccc',
            },
          },
          {
            cursor: 'ZGRk',
            node: {
              body: 'query { d }',
              hash: 'ddd',
            },
          },
        ],
        pageInfo: {
          hasNextPage: false,
        },
      },
      id: expect.any(String),
    },
  });
});

test('app deployment usage reporting', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createToken, project, target } = await createProject();
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryWrite, TargetAccessScope.RegistryRead],
  });

  const { createAppDeployment } = await execute({
    document: CreateAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: 'app-version',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(createAppDeployment.error).toBeNull();

  const sdl = /* GraphQL */ `
    type Query {
      a: String
      b: String
      c: String
      d: String
    }
  `;

  await token.publishSchema({
    sdl,
  });

  const { addDocumentsToAppDeployment } = await execute({
    document: AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: 'app-version',
        documents: [
          {
            hash: 'aaa',
            body: 'query { a }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(addDocumentsToAppDeployment.error).toBeNull();

  const { activateAppDeployment } = await execute({
    document: ActivateAppDeployment,
    variables: {
      input: {
        appName: 'app-name',
        appVersion: 'app-version',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(activateAppDeployment.error).toEqual(null);

  let data = await execute({
    document: GetAppDeployment,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'app-name',
      appDeploymentVersion: 'app-version',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(data.target?.appDeployment?.lastUsed).toEqual(null);

  const usageAddress = await getServiceHost('usage', 8081);

  const client = createHive({
    enabled: true,
    token: token.secret,
    usage: true,
    debug: false,
    agent: {
      logger: createLogger('debug'),
      maxSize: 1,
    },
    selfHosting: {
      usageEndpoint: 'http://' + usageAddress,
      graphqlEndpoint: 'http://noop/',
      applicationUrl: 'http://noop/',
    },
  });

  const request = new Request('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'x-graphql-client-name': 'app-name',
      'x-graphql-client-version': 'app-version',
    },
  });

  await client.collectUsage()(
    {
      document: parse(`query { a }`),
      schema: buildASTSchema(parse(sdl)),
      contextValue: { request },
    },
    {},
    'app-name~app-version~aaa',
  );

  await waitFor(5000);

  data = await execute({
    document: GetAppDeployment,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'app-name',
      appDeploymentVersion: 'app-version',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());
  expect(data.target?.appDeployment?.lastUsed).toEqual(expect.any(String));
});
