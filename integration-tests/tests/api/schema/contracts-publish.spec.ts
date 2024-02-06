import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
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
          targetId
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
  region: 'auto',
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
          targetId: target.id,
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
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
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
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

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
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
  'schema delete with successful initial contract composition',
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
          targetId: target.id,
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          excludeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
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
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
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
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
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
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
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

    const cdnAccessToken = await writeToken.createCdnAccess();

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

    const cdnAccessToken = await writeToken.createCdnAccess();

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

const DisabledContractMutation = graphql(`
  mutation DisableContractMutation($input: DisableContractInput!) {
    disableContract(input: $input) {
      ok {
        disabledContract {
          id
          isDisabled
        }
      }
      error {
        message
      }
    }
  }
`);

test.concurrent('disable contract results in CDN artifacts being removed', async ({ expect }) => {
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

  const contractId = createContractResult.createContract.ok?.createdContract.id;

  if (!contractId) {
    throw new Error('Missing contract id.');
  }

  const cdnAccessToken = await writeToken.createCdnAccess();

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
    document: DisabledContractMutation,
    variables: {
      input: {
        contractId,
      },
    },
    authToken: writeToken.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result?.disableContract.ok?.disabledContract.isDisabled).toEqual(true);

  response = await fetch(cdnAccessToken.cdnUrl + '/contracts/my-contract/sdl', {
    method: 'GET',
    headers: {
      'x-hive-cdn-key': cdnAccessToken.secretAccessToken,
    },
  });
  expect(response.status).toBe(404);
});

test.concurrent(
  'disable contract delete succeeds if no version/CDN artifacts have been published yet',
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

    const contractId = createContractResult.createContract.ok?.createdContract.id;

    if (!contractId) {
      throw new Error('Missing contract id.');
    }

    const cdnAccessToken = await writeToken.createCdnAccess();

    const result = await execute({
      document: DisabledContractMutation,
      variables: {
        input: {
          contractId,
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result?.disableContract.ok?.disabledContract.isDisabled).toEqual(true);

    const response = await fetch(cdnAccessToken.cdnUrl + '/contracts/my-contract/sdl', {
      method: 'GET',
      headers: {
        'x-hive-cdn-key': cdnAccessToken.secretAccessToken,
      },
    });
    expect(response.status).toBe(404);
  },
);

test.concurrent(
  'disable contract delete succeeds if no version/CDN artifacts have been published yet',
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

    const contractId = createContractResult.createContract.ok?.createdContract.id;

    if (!contractId) {
      throw new Error('Missing contract id.');
    }

    let result = await execute({
      document: DisabledContractMutation,
      variables: {
        input: {
          contractId,
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result?.disableContract.ok?.disabledContract.isDisabled).toEqual(true);

    result = await execute({
      document: DisabledContractMutation,
      variables: {
        input: {
          contractId,
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result?.disableContract.error?.message).toEqual('Contract already disabled found.');
  },
);
