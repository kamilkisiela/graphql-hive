import {
  createContract,
  deleteContract,
  deleteSchema,
  getSchemaVersionWithAllDetails,
  publishSchema,
  schemaVersionPromote,
} from 'testkit/flow';
import { ProjectType, ResourceAssignmentModeType } from 'testkit/gql/graphql';
import { assertNonNull, assertNonNullish } from 'testkit/utils';
import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import { SchemaVersionStore } from '@hive/api/modules/schema/providers/schema-version-store';
import { psql } from '@hive/postgres';
import { initSeed } from '../../../testkit/seed';

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
  key: string,
  bucketName = 'artifacts',
): Promise<null | { body: string; eTag: string; metadata: Record<string, string> }> {
  const getObjectCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  try {
    const result = await s3Client.send(getObjectCommand);
    return {
      body: await result.Body!.transformToString(),
      eTag: result.ETag!,
      metadata: result.Metadata!,
    };
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return null;
    }
    throw error;
  }
}

test.concurrent(
  'promote latest schema version within the same target via target input',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions } = await createProject(ProjectType.Federation);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: ['schemaVersion:publish', 'schemaVersion:promote'],
    });

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: target.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [promotedVersion, publishedVersion] = await fetchVersions(2);
    assertNonNull(promotedVersion);
    assertNonNull(publishedVersion);

    expect(promotedVersion.previousDiffableSchemaVersion?.id).toEqual(publishedVersion.id);
    expect(promotedVersion.valid).toEqual(true);
    expect(publishedVersion.valid).toEqual(true);
    expect(promotedVersion.supergraph).toEqual(publishedVersion.supergraph);
    expect(promotedVersion.origin).toMatchObject({
      __typename: 'SchemaVersionPromoteOrigin',
      schemaVersionId: publishedVersion.id,
      targetId: target.id,
      targetSlug: target.name,
    });
  },
);

test.concurrent(
  'promote latest schema version from one target to another empty target',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions, createTarget } = await createProject(ProjectType.Federation);
    const createTargetResult = await createTarget().then(r => r.expectNoGraphQLErrors());
    const otherTarget = createTargetResult.createTarget.ok?.createdTarget;
    assertNonNullish(otherTarget);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: ['schemaVersion:publish', 'schemaVersion:promote'],
    });

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: otherTarget.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [publishedVersion] = await fetchVersions(1);
    const [promotedVersion] = await fetchVersions(1, otherTarget);

    assertNonNull(promotedVersion);
    assertNonNull(publishedVersion);

    // we always compare to the latest schema version within the same target, thus this is null
    expect(promotedVersion.previousDiffableSchemaVersion).toEqual(null);
    expect(promotedVersion.valid).toEqual(true);
    expect(publishedVersion.valid).toEqual(true);
    expect(promotedVersion.supergraph).toEqual(publishedVersion.supergraph);
    expect(promotedVersion.origin).toMatchObject({
      __typename: 'SchemaVersionPromoteOrigin',
      schemaVersionId: publishedVersion.id,
      targetId: target.id,
      targetSlug: target.name,
    });
  },
);

test.concurrent(
  'promote latest schema version from one target to another non-empty target',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions, createTarget } = await createProject(ProjectType.Federation);
    const createTargetResult = await createTarget().then(r => r.expectNoGraphQLErrors());
    const otherTarget = createTargetResult.createTarget.ok?.createdTarget;
    assertNonNullish(otherTarget);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: ['schemaVersion:publish', 'schemaVersion:promote'],
    });

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    await publishSchema(
      {
        author: 'b',
        commit: 'b',
        sdl: /* GraphQL */ `
          type Query {
            b: String!
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: otherTarget.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: otherTarget.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [versionToPromote] = await fetchVersions(1);
    const [promotedVersion, publishedVersion] = await fetchVersions(2, otherTarget);

    assertNonNull(promotedVersion);
    assertNonNull(publishedVersion);

    // we always compare to the latest schema version within the same target, thus this is null
    expect(promotedVersion.previousDiffableSchemaVersion?.id).toEqual(publishedVersion.id);
    expect(promotedVersion.valid).toEqual(true);
    expect(publishedVersion.valid).toEqual(true);
    expect(promotedVersion.supergraph).not.toEqual(publishedVersion.supergraph);
    expect(promotedVersion.origin).toMatchObject({
      __typename: 'SchemaVersionPromoteOrigin',
      schemaVersionId: versionToPromote.id,
      targetId: target.id,
      targetSlug: target.name,
    });
  },
);

test.concurrent('promote specific schema version within the same target', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, createOrganizationAccessToken } = await createOrg();
  const { target, fetchVersions } = await createProject(ProjectType.Federation);
  const { privateAccessKey } = await createOrganizationAccessToken({
    resources: {
      mode: ResourceAssignmentModeType.All,
    },
    permissions: ['schemaVersion:publish', 'schemaVersion:promote'],
  });

  await publishSchema(
    {
      author: 'a',
      commit: 'a',
      sdl: /* GraphQL */ `
        type Query {
          a: String!
        }
      `,
      service: 'a',
      url: 'http://a',
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  await publishSchema(
    {
      author: 'a',
      commit: 'a',
      sdl: /* GraphQL */ `
        type Query {
          b: String!
        }
      `,
      service: 'a',
      url: 'http://a',
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  await publishSchema(
    {
      author: 'a',
      commit: 'a',
      sdl: /* GraphQL */ `
        type Query {
          c: String!
        }
      `,
      service: 'a',
      url: 'http://a',
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  const [previousVersion, , firstVersion] = await fetchVersions(3);
  assertNonNullish(firstVersion);
  expect(firstVersion.previousDiffableSchemaVersion).toEqual(null);

  const promoteResult = await schemaVersionPromote(
    {
      source: {
        fromSchemaVersionById: firstVersion.id,
      },
      target: {
        toTarget: {
          byId: target.id,
        },
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  expect(promoteResult.schemaVersionPromote).toMatchObject({
    ok: {},
    error: null,
  });
  const [promotedVersion] = await fetchVersions(1);
  expect(promotedVersion.origin).toMatchObject({
    __typename: 'SchemaVersionPromoteOrigin',
    schemaVersionId: firstVersion.id,
    targetId: target.id,
    targetSlug: target.slug,
  });
  expect(promotedVersion.previousDiffableSchemaVersion?.id).toEqual(previousVersion.id);
});

test.concurrent('promote non-existing schema version yields error', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, createOrganizationAccessToken } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);
  const { privateAccessKey } = await createOrganizationAccessToken({
    resources: {
      mode: ResourceAssignmentModeType.All,
    },
    permissions: ['schemaVersion:publish', 'schemaVersion:promote'],
  });

  const promoteResult = await schemaVersionPromote(
    {
      source: {
        fromSchemaVersionById: crypto.randomUUID(),
      },
      target: {
        toTarget: {
          byId: target.id,
        },
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  expect(promoteResult.schemaVersionPromote).toMatchObject({
    ok: {},
    error: {
      message: 'Schema Version not found.',
    },
  });
});

test.concurrent('promote contract schema version yields error', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, createOrganizationAccessToken } = await createOrg();
  const { target, fetchVersions } = await createProject(ProjectType.Federation);
  const { privateAccessKey } = await createOrganizationAccessToken({
    resources: {
      mode: ResourceAssignmentModeType.All,
    },
    permissions: [
      'schemaVersion:publish',
      'target:modifySettings',
      'project:describe',
      'schemaVersion:promote',
    ],
  });

  await createContract(
    {
      contractName: 'public',
      target: {
        byId: target.id,
      },
      includeTags: ['public'],
      removeUnreachableTypesFromPublicApiSchema: true,
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  await publishSchema(
    {
      author: 'a',
      commit: 'a',
      sdl: /* GraphQL */ `
        type Query {
          public: String! @tag(name: "public")
        }
      `,
      service: 'a',
      url: 'http://a',
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  const [publishedVersion] = await fetchVersions(1);
  assertNonNullish(publishedVersion);
  const version = await getSchemaVersionWithAllDetails(
    target.id,
    publishedVersion.id,
    privateAccessKey,
  );
  const contractVersion = version?.contractVersions?.edges.at(0)?.node;
  assertNonNullish(contractVersion);

  const promoteResult = await schemaVersionPromote(
    {
      source: {
        fromSchemaVersionById: contractVersion.id,
      },
      target: {
        toTarget: {
          byId: target.id,
        },
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  expect(promoteResult.schemaVersionPromote).toMatchObject({
    ok: {},
    error: {
      message: 'A contract schema version can not be promoted.',
    },
  });
});

test.concurrent(
  'promote schema version from different project yields error',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions } = await createProject(ProjectType.Federation);
    const { target: otherTarget } = await createProject(ProjectType.Federation);

    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: ['schemaVersion:publish', 'schemaVersion:promote'],
    });

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const [version] = await fetchVersions(1);
    assertNonNullish(version);

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromSchemaVersionById: version.id,
        },
        target: {
          toTarget: {
            byId: otherTarget.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: {
        message: 'Schema Version not found.',
      },
    });
  },
);

test.concurrent('missing schema publish permissions target yields error', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, createOrganizationAccessToken } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const { privateAccessKey } = await createOrganizationAccessToken({
    resources: {
      mode: ResourceAssignmentModeType.All,
    },
    permissions: ['project:describe'],
  });

  const promoteResultErrors = await schemaVersionPromote(
    {
      source: {
        fromTarget: {
          byId: target.id,
        },
      },
      target: {
        toTarget: {
          byId: target.id,
        },
      },
    },
    privateAccessKey,
  ).then(r => r.expectGraphQLErrors());
  expect(promoteResultErrors.length).toEqual(1);
  expect(promoteResultErrors.at(0)?.message).toEqual(
    `No access (reason: "Missing permission for performing 'schemaVersion:promote' on resource")`,
  );
  expect(promoteResultErrors.at(0)?.extensions?.code).toEqual(`UNAUTHORISED`);
});

test.concurrent(
  'promote valid schema version within target updates CDN artifacts',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions } = await createProject(ProjectType.Federation);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: ['schemaVersion:publish', 'schemaVersion:promote'],
    });

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: target.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [promotedVersion] = await fetchVersions(1);
    assertNonNullish(promotedVersion);

    const s3Artifact = await fetchS3ObjectArtifact(`artifact/${target.id}/supergraph`);
    assertNonNullish(s3Artifact);
    expect(s3Artifact.metadata).toEqual({
      'x-hive-schema-version-id': promotedVersion.id,
    });
  },
);

test.concurrent(
  'promote valid schema version to another target updated CDN artifacts',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions, createTarget } = await createProject(ProjectType.Federation);
    const createTargetResult = await createTarget().then(r => r.expectNoGraphQLErrors());
    const otherTarget = createTargetResult.createTarget.ok?.createdTarget;
    assertNonNullish(otherTarget);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: ['schemaVersion:publish', 'schemaVersion:promote'],
    });

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: otherTarget.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [promotedVersion] = await fetchVersions(1, otherTarget);
    assertNonNullish(promotedVersion);

    const s3Artifact = await fetchS3ObjectArtifact(`artifact/${otherTarget.id}/supergraph`);
    assertNonNullish(s3Artifact);
    expect(s3Artifact.metadata).toEqual({
      'x-hive-schema-version-id': promotedVersion.id,
    });
  },
);

test.concurrent(
  'promote schema version within target moves along active contracts',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions } = await createProject(ProjectType.Federation);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: [
        'schemaVersion:publish',
        'target:modifySettings',
        'project:describe',
        'schemaVersion:promote',
      ],
    });

    await createContract(
      {
        contractName: 'public',
        target: {
          byId: target.id,
        },
        includeTags: ['public'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
            b: String! @tag(name: "public")
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: target.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [promotedVersion, publishedVersion] = await fetchVersions(2);
    assertNonNullish(promotedVersion);
    assertNonNullish(publishedVersion);

    const version = await getSchemaVersionWithAllDetails(
      target.id,
      promotedVersion.id,
      privateAccessKey,
    );
    assertNonNullish(version);
    expect(version.contractVersions?.edges.length).toEqual(1);
  },
);

test.concurrent(
  'promote schema version within target ignores deleted contracts',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions } = await createProject(ProjectType.Federation);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: [
        'schemaVersion:publish',
        'target:modifySettings',
        'project:describe',
        'schemaVersion:promote',
      ],
    });

    await createContract(
      {
        contractName: 'public',
        target: {
          byId: target.id,
        },
        includeTags: ['public'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const contractId = await createContract(
      {
        contractName: 'public-2',
        target: {
          byId: target.id,
        },
        includeTags: ['public'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
      privateAccessKey,
    )
      .then(r => r.expectNoGraphQLErrors())
      .then(r => r.createContract.ok?.createdContract.id);
    assertNonNullish(contractId);

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
            b: String! @tag(name: "public")
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    await deleteContract(
      {
        contract: {
          byId: contractId,
        },
      },
      privateAccessKey,
    );

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: target.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [promotedVersion, publishedVersion] = await fetchVersions(2);
    assertNonNullish(promotedVersion);
    assertNonNullish(publishedVersion);

    const promotedVersionDetails = await getSchemaVersionWithAllDetails(
      target.id,
      promotedVersion.id,
      privateAccessKey,
    );
    assertNonNullish(promotedVersionDetails);
    expect(promotedVersionDetails.contractVersions?.edges.length).toEqual(1);

    expect(
      promotedVersionDetails.contractVersions?.edges.map(edge => edge.node.contractName),
    ).toEqual(['public']);

    const publishedVersionDetails = await getSchemaVersionWithAllDetails(
      target.id,
      publishedVersion.id,
      privateAccessKey,
    );
    assertNonNull(publishedVersionDetails);
    expect(publishedVersionDetails.contractVersions?.edges.length).toEqual(2);
    expect(
      publishedVersionDetails.contractVersions?.edges.map(edge => edge.node.contractName),
    ).toEqual(['public', 'public-2']);
  },
);

test.concurrent(
  'promote schema version within target includes contract version for contract definition added after the origin version was created',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions } = await createProject(ProjectType.Federation);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: [
        'schemaVersion:publish',
        'target:modifySettings',
        'project:describe',
        'schemaVersion:promote',
      ],
    });

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
            b: String! @tag(name: "public")
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    await createContract(
      {
        contractName: 'public',
        target: {
          byId: target.id,
        },
        includeTags: ['public'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: target.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [promotedVersion, publishedVersion] = await fetchVersions(2);
    assertNonNullish(promotedVersion);
    assertNonNullish(publishedVersion);

    const promotedVersionDetails = await getSchemaVersionWithAllDetails(
      target.id,
      promotedVersion.id,
      privateAccessKey,
    );
    assertNonNullish(promotedVersionDetails);
    expect(promotedVersionDetails.contractVersions?.edges.length).toEqual(1);

    expect(
      promotedVersionDetails.contractVersions?.edges.map(edge => edge.node.contractName),
    ).toEqual(['public']);

    const publishedVersionDetails = await getSchemaVersionWithAllDetails(
      target.id,
      publishedVersion.id,
      privateAccessKey,
    );
    assertNonNull(publishedVersionDetails);
    expect(publishedVersionDetails.contractVersions).toEqual(null);
  },
);

test.concurrent('promote delete schema version results in correct state', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, createOrganizationAccessToken } = await createOrg();
  const { target, fetchVersions } = await createProject(ProjectType.Federation);
  const { privateAccessKey } = await createOrganizationAccessToken({
    resources: {
      mode: ResourceAssignmentModeType.All,
    },
    permissions: ['schemaVersion:publish', 'schemaVersion:promote', 'schemaVersion:deleteService'],
  });

  await publishSchema(
    {
      author: 'a',
      commit: 'a',
      sdl: /* GraphQL */ `
        type Query {
          a: String!
        }
      `,
      service: 'a',
      url: 'http://a',
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());
  await publishSchema(
    {
      author: 'b',
      commit: 'b',
      sdl: /* GraphQL */ `
        type Query {
          b: String!
        }
      `,
      service: 'b',
      url: 'http://b',
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());
  await deleteSchema(
    {
      serviceName: 'a',
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  const promoteResult = await schemaVersionPromote(
    {
      source: {
        fromTarget: {
          byId: target.id,
        },
      },
      target: {
        toTarget: {
          byId: target.id,
        },
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  expect(promoteResult.schemaVersionPromote).toMatchObject({
    ok: {},
    error: null,
  });

  const [promotedVersion, serviceDeletedVersion] = await fetchVersions(2);
  assertNonNull(promotedVersion);
  assertNonNull(serviceDeletedVersion);

  expect(promotedVersion.previousDiffableSchemaVersion?.id).toEqual(serviceDeletedVersion.id);
  expect(promotedVersion.valid).toEqual(true);
  expect(serviceDeletedVersion.valid).toEqual(true);
  expect(promotedVersion.supergraph).toEqual(serviceDeletedVersion.supergraph);
});

test.concurrent('promote monolith schema version succeeds', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, createOrganizationAccessToken } = await createOrg();
  const { target, fetchVersions } = await createProject(ProjectType.Single);
  const { privateAccessKey } = await createOrganizationAccessToken({
    resources: {
      mode: ResourceAssignmentModeType.All,
    },
    permissions: [
      'schemaVersion:publish',
      'target:modifySettings',
      'project:describe',
      'schemaVersion:promote',
    ],
  });

  await publishSchema(
    {
      author: 'a',
      commit: 'a',
      sdl: /* GraphQL */ `
        type Query {
          a: String!
        }
      `,
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());
  await publishSchema(
    {
      author: 'b',
      commit: 'b',
      sdl: /* GraphQL */ `
        type Query {
          b: String!
        }
      `,
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  const [publishedVersion, versionToPromote] = await fetchVersions(2);
  assertNonNullish(versionToPromote);
  assertNonNullish(publishedVersion);
  expect(versionToPromote.sdl).toContain('a: String!');

  let promoteResult = await schemaVersionPromote(
    {
      source: {
        fromSchemaVersionById: versionToPromote.id,
      },
      target: {
        toTarget: {
          byId: target.id,
        },
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  expect(promoteResult.schemaVersionPromote.error).toEqual(null);
  assertNonNullish(promoteResult.schemaVersionPromote.ok);
  let promotedVersionDetails = await getSchemaVersionWithAllDetails(
    target.id,
    promoteResult.schemaVersionPromote.ok.newSchemaVersion.id,
    privateAccessKey,
  );
  assertNonNull(promotedVersionDetails);
  expect(promotedVersionDetails.origin).toEqual({
    __typename: 'SchemaVersionPromoteOrigin',
    schemaVersionId: versionToPromote.id,
  });
  expect(promotedVersionDetails.sdl).toContain('a: String!');

  // why not also promote another version just to be sure
  promoteResult = await schemaVersionPromote(
    {
      source: {
        fromSchemaVersionById: publishedVersion.id,
      },
      target: {
        toTarget: {
          byId: target.id,
        },
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  expect(promoteResult.schemaVersionPromote.error).toEqual(null);
  assertNonNullish(promoteResult.schemaVersionPromote.ok);
  promotedVersionDetails = await getSchemaVersionWithAllDetails(
    target.id,
    promoteResult.schemaVersionPromote.ok.newSchemaVersion.id,
    privateAccessKey,
  );
  assertNonNull(promotedVersionDetails);
  expect(promotedVersionDetails.origin).toEqual({
    __typename: 'SchemaVersionPromoteOrigin',
    schemaVersionId: publishedVersion.id,
  });
  expect(promotedVersionDetails.sdl).toContain('b: String!');
});

test.concurrent('promote monolith version to empty target', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, createOrganizationAccessToken } = await createOrg();
  const { target, fetchVersions, createTarget } = await createProject(ProjectType.Single);
  const otherTarget = await createTarget().then(r => r.expectNoGraphQLErrors());
  const { privateAccessKey } = await createOrganizationAccessToken({
    resources: {
      mode: ResourceAssignmentModeType.All,
    },
    permissions: [
      'schemaVersion:publish',
      'target:modifySettings',
      'project:describe',
      'schemaVersion:promote',
    ],
  });

  await publishSchema(
    {
      author: 'a',
      commit: 'a',
      sdl: /* GraphQL */ `
        type Query {
          a: String!
        }
      `,
      target: {
        byId: target.id,
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  const [versionToPromote] = await fetchVersions(1);

  assertNonNullish(otherTarget.createTarget.ok);
  let promoteResult = await schemaVersionPromote(
    {
      source: {
        fromSchemaVersionById: versionToPromote.id,
      },
      target: {
        toTarget: {
          byId: otherTarget.createTarget.ok.createdTarget.id,
        },
      },
    },
    privateAccessKey,
  ).then(r => r.expectNoGraphQLErrors());

  expect(promoteResult.schemaVersionPromote.error).toEqual(null);
  assertNonNullish(promoteResult.schemaVersionPromote.ok);
});

test.concurrent(
  'promote schema version within target diffs a contract version composed from scratch against the latest contract version of the target',
  async ({ expect }) => {
    const seed = initSeed();
    const { createOrg } = await seed.createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions } = await createProject(ProjectType.Federation);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: [
        'schemaVersion:publish',
        'target:modifySettings',
        'project:describe',
        'schemaVersion:promote',
      ],
    });

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
            b: String! @tag(name: "public")
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    await createContract(
      {
        contractName: 'public',
        target: {
          byId: target.id,
        },
        includeTags: ['public'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    await publishSchema(
      {
        author: 'a',
        commit: 'b',
        sdl: /* GraphQL */ `
          type Query {
            a: String!
            b: String! @tag(name: "public")
            c: String! @tag(name: "public")
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const [latestVersion, firstVersion] = await fetchVersions(2);
    assertNonNullish(latestVersion);
    assertNonNullish(firstVersion);

    const latestVersionDetails = await getSchemaVersionWithAllDetails(
      target.id,
      latestVersion.id,
      privateAccessKey,
    );
    const latestContractVersion = latestVersionDetails?.contractVersions?.edges.at(0)?.node;
    assertNonNullish(latestContractVersion);

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromSchemaVersionById: firstVersion.id,
        },
        target: {
          toTarget: {
            byId: target.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [promotedVersion] = await fetchVersions(1);
    assertNonNullish(promotedVersion);

    const promotedVersionDetails = await getSchemaVersionWithAllDetails(
      target.id,
      promotedVersion.id,
      privateAccessKey,
    );
    const promotedContractVersion = promotedVersionDetails?.contractVersions?.edges.at(0)?.node;
    assertNonNullish(promotedContractVersion);

    // The promoted version predates the contract, so the contract is composed from scratch
    // and compared against the latest contract version of the target, which still has "c".
    expect(
      promotedContractVersion.breakingSchemaChanges?.edges.map(edge => edge.node.message),
    ).toEqual(["Field 'c' was removed from object type 'Query'"]);

    await using db = await seed.createDbConnection();
    const schemaVersions = new SchemaVersionStore(db.pool);
    await expect(
      schemaVersions.getSchemaVersionById(promotedContractVersion.id),
    ).resolves.toMatchObject({
      previousSchemaVersionId: latestContractVersion.id,
      diffSchemaVersionId: latestContractVersion.id,
    });
  },
);

test.concurrent(
  'promote schema version to another target composes the contracts of the target promoted to',
  async ({ expect }) => {
    const seed = initSeed();
    const { createOrg } = await seed.createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, fetchVersions, createTarget } = await createProject(ProjectType.Federation);
    const createTargetResult = await createTarget().then(r => r.expectNoGraphQLErrors());
    const otherTarget = createTargetResult.createTarget.ok?.createdTarget;
    assertNonNullish(otherTarget);
    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: {
        mode: ResourceAssignmentModeType.All,
      },
      permissions: [
        'schemaVersion:publish',
        'target:modifySettings',
        'project:describe',
        'schemaVersion:promote',
      ],
    });

    const sourceContractId = await createContract(
      {
        contractName: 'source',
        target: {
          byId: target.id,
        },
        includeTags: ['source'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
      privateAccessKey,
    )
      .then(r => r.expectNoGraphQLErrors())
      .then(r => r.createContract.ok?.createdContract.id);
    assertNonNullish(sourceContractId);

    const destinationContractId = await createContract(
      {
        contractName: 'destination',
        target: {
          byId: otherTarget.id,
        },
        includeTags: ['destination'],
        removeUnreachableTypesFromPublicApiSchema: true,
      },
      privateAccessKey,
    )
      .then(r => r.expectNoGraphQLErrors())
      .then(r => r.createContract.ok?.createdContract.id);
    assertNonNullish(destinationContractId);

    await publishSchema(
      {
        author: 'a',
        commit: 'a',
        sdl: /* GraphQL */ `
          type Query {
            a: String! @tag(name: "source")
            b: String! @tag(name: "destination")
          }
        `,
        service: 'a',
        url: 'http://a',
        target: {
          byId: target.id,
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    const promoteResult = await schemaVersionPromote(
      {
        source: {
          fromTarget: {
            byId: target.id,
          },
        },
        target: {
          toTarget: {
            byId: otherTarget.id,
          },
        },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());

    expect(promoteResult.schemaVersionPromote).toMatchObject({
      ok: {},
      error: null,
    });

    const [promotedVersion] = await fetchVersions(1, otherTarget);
    assertNonNullish(promotedVersion);

    const promotedVersionDetails = await getSchemaVersionWithAllDetails(
      otherTarget.id,
      promotedVersion.id,
      privateAccessKey,
    );
    expect(promotedVersionDetails?.contractVersions?.edges.length).toEqual(1);
    const promotedContractVersion = promotedVersionDetails?.contractVersions?.edges.at(0)?.node;
    assertNonNullish(promotedContractVersion);
    expect(promotedContractVersion.contractName).toEqual('destination');
    expect(promotedContractVersion.compositeSchemaSDL).toContain('b: String!');
    expect(promotedContractVersion.compositeSchemaSDL).not.toContain('a: String!');

    // The contract version belongs to the contract graph of the target promoted to,
    // while the contract graph of the source target only has the published version.
    await using db = await seed.createDbConnection();
    const schemaVersions = new SchemaVersionStore(db.pool);
    await expect(
      schemaVersions.getSchemaVersionById(promotedContractVersion.id),
    ).resolves.toMatchObject({
      targetId: otherTarget.id,
      graphId: destinationContractId,
    });
    await expect(
      db.pool.oneFirst(psql`
        SELECT count(*)::int FROM "schema_versions" WHERE "graph_id" = ${sourceContractId}
      `),
    ).resolves.toEqual(1);
  },
);
