import { ProjectType } from 'testkit/gql/graphql';
import { assertNonNullish } from 'testkit/utils';
import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import { graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';

const CreateContractMutation = graphql(`
  mutation CreateContractMutation2($input: CreateContractInput!) {
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
          target
          contractName
          includeTags
          excludeTags
        }
      }
    }
  }
`);

const s3Client = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

async function fetchS3ObjectArtifact(
  bucketName: string,
  key: string,
): Promise<null | { body: string; eTag: string }> {
  const getObjectCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  try {
    const result = await s3Client.send(getObjectCommand);
    return {
      body: await result.Body!.transformToString(),
      eTag: result.ETag!,
    };
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return null;
    }
    throw error;
  }
}

test.concurrent(
  'schema publish with successful initial contract composition',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

    // Publish schema with write rights
    let publishResult = await writeToken
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

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          target: { byId: target.id },
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Publish schema with write rights
    publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String
            helloHidden: String @tag(name: "toyota")
            foo: String
          }
        `,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    const sdlArtifact = await fetchS3ObjectArtifact(
      'artifacts',
      `artifact/${target.id}/contracts/my-contract/sdl`,
    );
    const supergraphArtifact = await fetchS3ObjectArtifact(
      'artifacts',
      `artifact/${target.id}/contracts/my-contract/supergraph`,
    );

    expect(sdlArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
      type Query {
        helloHidden: String
      }
    `);
    expect(supergraphArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
      type Query @join__type(graph: HELLO) {
        hello: String @inaccessible
        helloHidden: String
        foo: String @inaccessible
      }
    `);
  },
);

test.concurrent('schema publish with failing initial contract composition', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

  // Publish schema with write rights
  let publishResult = await writeToken
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

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Publish schema with write rights
  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String @tag(name: "toyota")
          foo: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const sdlArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/sdl`,
  );
  const supergraphArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/supergraph`,
  );

  expect(sdlArtifact).toEqual(null);
  expect(supergraphArtifact).toEqual(null);
});

test.concurrent('schema publish with succeeding contract composition', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['toyota'],
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String
          bar: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const sdlArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/sdl`,
  );
  const supergraphArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/supergraph`,
  );

  expect(sdlArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
    type Query {
      hello: String
      bar: String
    }
  `);
  expect(supergraphArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
    type Query @join__type(graph: HELLO) {
      hello: String
      helloHidden: String @inaccessible
      bar: String
    }
  `);
});

test.concurrent('schema publish with failing contract composition', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String @tag(name: "toyota")
          bar: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const sdlArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/sdl`,
  );
  const supergraphArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/supergraph`,
  );

  expect(sdlArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
    type Query {
      helloHidden: String
    }
  `);
  expect(supergraphArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
    type Query @join__type(graph: HELLO) {
      hello: String @inaccessible
      helloHidden: String
    }
  `);
});

test.concurrent(
  'schema publish with failing contract composition can be rejected',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);
    const writeToken = await createTargetAccessToken({});

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          target: { byId: target.id },
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          excludeTags: ['toyota'],
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    const validSdl = /* GraphQL */ `
      extend schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

      type Query {
        hello: String @tag(name: "toyota")
        helloHidden: String
      }
    `;

    const validPublish = await writeToken
      .publishSchema({
        sdl: validSdl,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(validPublish.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const rejectedPublish = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String @tag(name: "toyota")
            helloHidden: String @tag(name: "toyota")
            bar: String @tag(name: "toyota")
          }
        `,
        service: 'hello',
        url: 'http://hello.com',
        failOnCompositionError: true,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(rejectedPublish.schemaPublish).toMatchObject({
      __typename: 'SchemaPublishError',
      valid: false,
      errors: {
        total: 1,
      },
    });

    const unchangedPublish = await writeToken
      .publishSchema({
        sdl: validSdl,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(unchangedPublish.schemaPublish).toMatchObject({
      __typename: 'SchemaPublishSuccess',
      valid: true,
      changes: {
        total: 0,
      },
    });
  },
);

test.concurrent(
  'schema delete with successful initial contract composition',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

    // Publish schema with write rights
    let publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String
          }
        `,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hi: String
          }
        `,
        service: 'hi',
        url: 'http://hi.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          target: { byId: target.id },
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          excludeTags: ['toyota'],
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    const deleteServiceResult = await writeToken
      .deleteSchema('hi')
      .then(r => r.expectNoGraphQLErrors());
    expect(deleteServiceResult.schemaDelete.__typename).toBe('SchemaDeleteSuccess');

    const sdlArtifact = await fetchS3ObjectArtifact(
      'artifacts',
      `artifact/${target.id}/contracts/my-contract/sdl`,
    );
    const supergraphArtifact = await fetchS3ObjectArtifact(
      'artifacts',
      `artifact/${target.id}/contracts/my-contract/supergraph`,
    );

    expect(sdlArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);
    expect(supergraphArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
      type Query @join__type(graph: HELLO) {
        hello: String
      }
    `);
  },
);

test.concurrent('schema delete with failing initial contract composition', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hi: String
        }
      `,
      service: 'hi',
      url: 'http://hi.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['toyota'],
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  const deleteServiceResult = await writeToken
    .deleteSchema('hi')
    .then(r => r.expectNoGraphQLErrors());
  expect(deleteServiceResult.schemaDelete.__typename).toBe('SchemaDeleteSuccess');

  const sdlArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/sdl`,
  );
  const supergraphArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/supergraph`,
  );

  expect(sdlArtifact).toEqual(null);
  expect(supergraphArtifact).toEqual(null);
});

test.concurrent('schema delete with succeeding contract composition', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hi: String
        }
      `,
      service: 'hi',
      url: 'http://hi.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const deleteServiceResult = await writeToken
    .deleteSchema('hi')
    .then(r => r.expectNoGraphQLErrors());
  expect(deleteServiceResult.schemaDelete.__typename).toBe('SchemaDeleteSuccess');

  const sdlArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/sdl`,
  );
  const supergraphArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/supergraph`,
  );

  expect(sdlArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
    type Query {
      hello: String
    }
  `);
  expect(supergraphArtifact?.body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
    type Query @join__type(graph: HELLO) {
      hello: String
    }
  `);
});

test.concurrent('schema delete with failing contract composition', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['toyota'],
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hi: String
        }
      `,
      service: 'hi',
      url: 'http://hi.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const deleteServiceResult = await writeToken
    .deleteSchema('hi')
    .then(r => r.expectNoGraphQLErrors());
  expect(deleteServiceResult.schemaDelete.__typename).toBe('SchemaDeleteSuccess');

  const sdlArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/sdl`,
  );
  const supergraphArtifact = await fetchS3ObjectArtifact(
    'artifacts',
    `artifact/${target.id}/contracts/my-contract/supergraph`,
  );

  expect(sdlArtifact).toEqual(null);
  expect(supergraphArtifact).toEqual(null);
});

test.concurrent(
  'successful contracts schema can be fetched from the CDN with CDN access token',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, createCdnAccess, target } = await createProject(
      ProjectType.Federation,
    );

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          target: { byId: target.id },
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          excludeTags: ['toyota'],
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    const cdnAccessToken = await createCdnAccess();

    // Publish schema with write rights
    let publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String
          }
        `,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    const response = await fetch(cdnAccessToken.cdnUrl + '/contracts/my-contract/sdl', {
      method: 'GET',
      headers: {
        'x-hive-cdn-key': cdnAccessToken.secretAccessToken,
      },
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);
  },
);

test.concurrent(
  'failed contracts schema can not be fetched from the CDN with CDN access token',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, setFeatureFlag } = await createOrg();
    const { createTargetAccessToken, createCdnAccess, target, setNativeFederation } =
      await createProject(ProjectType.Federation);

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          target: { byId: target.id },
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          excludeTags: ['toyota'],
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    const cdnAccessToken = await createCdnAccess();

    // Publish schema with write rights
    let publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String @tag(name: "toyota")
          }
        `,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    const response = await fetch(cdnAccessToken.cdnUrl + '/contracts/my-contract/sdl', {
      method: 'GET',
      headers: {
        'x-hive-cdn-key': cdnAccessToken.secretAccessToken,
      },
    });
    expect(response.status).toBe(404);
  },
);

const DeleteContractMutation = graphql(`
  mutation DeleteContractMutation($input: DeleteContractInput!) {
    deleteContract(input: $input) {
      ok {
        deletedContractId
      }
      error {
        message
      }
    }
  }
`);

const LatestSchemaVersionContractVersionsQuery = graphql(`
  query LatestSchemaVersionContractVersionsQuery($target: TargetReferenceInput!) {
    target(reference: $target) {
      latestSchemaVersion {
        contractVersions {
          edges {
            node {
              id
              contractName
            }
          }
        }
      }
    }
  }
`);

test.concurrent('delete contract results in CDN artifacts being removed', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken, createCdnAccess, target } = await createProject(
    ProjectType.Federation,
  );

  // Create a token with write rights
  const writeToken = await createTargetAccessToken({});

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  const contractId = createContractResult.createContract.ok?.createdContract.id;

  if (!contractId) {
    throw new Error('Missing contract id.');
  }

  const cdnAccessToken = await createCdnAccess();

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  let response = await fetch(cdnAccessToken.cdnUrl + '/contracts/my-contract/sdl', {
    method: 'GET',
    headers: {
      'x-hive-cdn-key': cdnAccessToken.secretAccessToken,
    },
  });
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toIncludeSubstringWithoutWhitespace(/* GraphQL */ `
    type Query {
      hello: String
    }
  `);

  const result = await execute({
    document: DeleteContractMutation,
    variables: {
      input: {
        contract: { byId: contractId },
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result?.deleteContract.ok?.deletedContractId).toEqual(contractId);

  const latestVersion = await execute({
    document: LatestSchemaVersionContractVersionsQuery,
    variables: { target: { byId: target.id } },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());
  expect(latestVersion.target?.latestSchemaVersion?.contractVersions?.edges).toEqual([
    {
      node: expect.objectContaining({ contractName: 'my-contract' }),
    },
  ]);

  response = await fetch(cdnAccessToken.cdnUrl + '/contracts/my-contract/sdl', {
    method: 'GET',
    headers: {
      'x-hive-cdn-key': cdnAccessToken.secretAccessToken,
    },
  });
  expect(response.status).toBe(404);
});

test.concurrent(
  'delete contract succeeds if no version/CDN artifacts have been published yet',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, createCdnAccess, target } = await createProject(
      ProjectType.Federation,
    );

    // Create a token with write rights
    const writeToken = await createTargetAccessToken({});

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          target: { byId: target.id },
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          excludeTags: ['toyota'],
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    const contractId = createContractResult.createContract.ok?.createdContract.id;

    if (!contractId) {
      throw new Error('Missing contract id.');
    }

    const cdnAccessToken = await createCdnAccess();

    const result = await execute({
      document: DeleteContractMutation,
      variables: {
        input: {
          contract: { byId: contractId },
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result?.deleteContract.ok?.deletedContractId).toEqual(contractId);

    const response = await fetch(cdnAccessToken.cdnUrl + '/contracts/my-contract/sdl', {
      method: 'GET',
      headers: {
        'x-hive-cdn-key': cdnAccessToken.secretAccessToken,
      },
    });
    expect(response.status).toBe(404);
  },
);

test.concurrent('deleting a missing contract returns an error', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  const contractId = createContractResult.createContract.ok?.createdContract.id;
  assertNonNullish(contractId, 'Missing contract id.');

  let result = await execute({
    document: DeleteContractMutation,
    variables: {
      input: {
        contract: { byId: contractId },
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result?.deleteContract.ok?.deletedContractId).toEqual(contractId);

  result = await execute({
    document: DeleteContractMutation,
    variables: {
      input: {
        contract: { byId: contractId },
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result?.deleteContract.error?.message).toEqual('Contract not found.');
});

test.concurrent(
  'schema publish after deleting a contract creates a new schema version without the contract',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, fetchVersions, target } = await createProject(
      ProjectType.Federation,
    );
    const writeToken = await createTargetAccessToken({});

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          target: { byId: target.id },
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());
    const contractId = createContractResult.createContract.ok?.createdContract.id;
    assertNonNullish(contractId);

    const sdl = /* GraphQL */ `
      extend schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

      type Query {
        hello: String
        helloHidden: String @tag(name: "toyota")
      }
    `;

    const publishResult = await writeToken
      .publishSchema({
        sdl,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const deleteResult = await execute({
      document: DeleteContractMutation,
      variables: {
        input: {
          contract: { byId: contractId },
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());
    expect(deleteResult.deleteContract.ok?.deletedContractId).toEqual(contractId);

    // The subgraph did not change, but the set of contracts did.
    const republishResult = await writeToken
      .publishSchema({
        sdl,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());
    expect(republishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    await expect(fetchVersions(2)).resolves.toHaveLength(2);

    const latestVersion = await execute({
      document: LatestSchemaVersionContractVersionsQuery,
      variables: { target: { byId: target.id } },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());
    expect(latestVersion.target?.latestSchemaVersion?.contractVersions).toEqual(null);
  },
);
