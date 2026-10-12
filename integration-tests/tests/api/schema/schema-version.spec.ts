import { ProjectType } from 'testkit/gql/graphql';
import { assertNonNullish } from 'testkit/utils';
import { psql } from '@hive/postgres';
import { createContract, getSchemaVersionWithAllDetails } from '../../../testkit/flow';
import { DocumentType, graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';

const SchemaByCommitQuery = graphql(/* GraphQL */ `
  query SchemaByCommitQuery($commit: String!, $targetRef: TargetReferenceInput) {
    schemaVersionByCommit(commit: $commit, target: $targetRef) {
      id
      sdl
      meta {
        author
        commit
      }
    }
  }
`);

const PaginatedSchemaVersionsQuery = graphql(/* GraphQL */ `
  query PaginatedSchemaVersionsQuery(
    $targetRef: TargetReferenceInput!
    $first: Int!
    $after: String
  ) {
    target(reference: $targetRef) {
      schemaVersions(first: $first, after: $after) {
        edges {
          cursor
          node {
            meta {
              commit
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`);

const SchemaVersionGraphScopeQuery = graphql(/* GraphQL */ `
  query SchemaVersionGraphScopeQuery(
    $projectRef: ProjectReferenceInput!
    $targetRef: TargetReferenceInput!
    $baseVersionId: ID!
    $contractVersionId: ID!
    $period: DateRangeInput
  ) {
    project(reference: $projectRef) {
      schemaVersionsCount(period: $period)
    }
    target(reference: $targetRef) {
      baseVersion: schemaVersion(id: $baseVersionId) {
        id
      }
      contractVersion: schemaVersion(id: $contractVersionId) {
        id
      }
      schemaVersionsCount(period: $period)
    }
  }
`);

test.concurrent(
  'schema version lookup and counts only include default graph versions',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { project, target, createTargetAccessToken, fetchVersions } = await createProject(
      ProjectType.Federation,
    );
    const token = await createTargetAccessToken({});

    await createContract(
      {
        target: { byId: target.id },
        contractName: 'public',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['public'],
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());

    const period = {
      from: new Date(Date.now() - 60_000).toISOString(),
      to: new Date(Date.now() + 60_000).toISOString(),
    };

    await token
      .publishSchema({
        commit: 'base-version',
        service: 'products',
        url: 'http://products.com',
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            product: String @tag(name: "public")
          }
        `,
      })
      .then(r => r.expectNoGraphQLErrors());

    const [baseVersion] = await fetchVersions(1);
    assertNonNullish(baseVersion);
    const details = await getSchemaVersionWithAllDetails(target.id, baseVersion.id, ownerToken);
    const contractVersion = details?.contractVersions?.edges.at(0)?.node;
    assertNonNullish(contractVersion);

    for (const countPeriod of [null, period]) {
      const result = await execute({
        document: SchemaVersionGraphScopeQuery,
        authToken: ownerToken,
        variables: {
          projectRef: { byId: project.id },
          targetRef: { byId: target.id },
          baseVersionId: baseVersion.id,
          contractVersionId: contractVersion.id,
          period: countPeriod,
        },
      }).then(r => r.expectNoGraphQLErrors());

      expect(result.target?.baseVersion?.id).toBe(baseVersion.id);
      expect(result.target?.contractVersion).toBeNull();
      expect(result.target?.schemaVersionsCount).toBe(1);
      expect(result.project?.schemaVersionsCount).toBe(1);
    }
  },
);

test.concurrent(
  'schema version pagination excludes contract versions from the default graph',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);
    const token = await createTargetAccessToken({});

    await token
      .publishSchema({
        commit: 'before-contract',
        service: 'products',
        url: 'http://products.com',
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            product: String @tag(name: "public")
          }
        `,
      })
      .then(r => r.expectNoGraphQLErrors());

    const createContractResult = await createContract(
      {
        target: { byId: target.id },
        contractName: 'public',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['public'],
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());
    expect(createContractResult.createContract.error).toBeNull();

    await token
      .publishSchema({
        commit: 'with-contract',
        service: 'products',
        url: 'http://products.com',
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            product: String @tag(name: "public")
            internalProduct: String
          }
        `,
      })
      .then(r => r.expectNoGraphQLErrors());

    const commits: Array<string | null> = [];
    let after: string | null = null;
    let result: DocumentType<typeof PaginatedSchemaVersionsQuery>;

    do {
      result = await execute({
        document: PaginatedSchemaVersionsQuery,
        authToken: token.secret,
        variables: {
          targetRef: { byId: target.id },
          first: 1,
          after,
        },
      }).then(r => r.expectNoGraphQLErrors());

      const connection = result.target?.schemaVersions;
      assertNonNullish(connection);
      expect(connection.edges).toHaveLength(1);

      commits.push(connection.edges[0].node.meta?.commit ?? null);
      after = connection.pageInfo.endCursor;
      if (!connection.pageInfo.hasNextPage) {
        break;
      }
    } while (after);

    expect(commits).toEqual(['with-contract', 'before-contract']);
  },
);

test.concurrent(
  'schema version pagination excludes legacy versions without duplicates',
  async ({ expect }) => {
    const seed = initSeed();
    const { createOrg } = await seed.createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Single);
    const token = await createTargetAccessToken({});

    for (const commit of ['legacy-1', 'legacy-2']) {
      await token
        .publishSchema({
          commit,
          sdl: `type Query { ${commit.replace('-', '_')}: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());
    }

    await using db = await seed.createDbConnection();
    await db.pool.query(psql`
      UPDATE "schema_versions"
      SET
        "graph_id" = NULL
        , "graph_metadata" = NULL
      WHERE "target_id" = ${target.id}
    `);

    for (const commit of ['linked-1', 'linked-2']) {
      await token
        .publishSchema({
          commit,
          sdl: `type Query { ${commit.replace('-', '_')}: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());
    }

    const commits: Array<string | null> = [];
    let after: string | null = null;
    let result: DocumentType<typeof PaginatedSchemaVersionsQuery>;

    do {
      result = await execute({
        document: PaginatedSchemaVersionsQuery,
        authToken: token.secret,
        variables: {
          targetRef: { byId: target.id },
          first: 1,
          after,
        },
      }).then(r => r.expectNoGraphQLErrors());

      const connection = result.target?.schemaVersions;
      assertNonNullish(connection);
      expect(connection.edges).toHaveLength(1);

      commits.push(connection.edges[0].node.meta?.commit ?? null);
      after = connection.pageInfo.endCursor;
      if (!connection.pageInfo.hasNextPage) {
        break;
      }
    } while (after);

    expect(commits).toEqual(['linked-2', 'linked-1']);
    expect(new Set(commits).size).toBe(commits.length);
  },
);

test.concurrent(
  'schema version pagination includes legacy versions and excludes contract versions for backfilled graph',
  async ({ expect }) => {
    const seed = initSeed();
    const { createOrg, ownerToken } = await seed.createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);
    const token = await createTargetAccessToken({});
    await using db = await seed.createDbConnection();

    await db.pool.query(psql`
      UPDATE "graphs"
      SET "is_backfilled" = TRUE
      WHERE "target_id" = ${target.id}
    `);

    for (const commit of ['legacy-1', 'legacy-2']) {
      await token
        .publishSchema({
          commit,
          service: 'products',
          url: 'http://products.com',
          sdl: `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              ${commit.replace('-', '_')}: String @tag(name: "public")
            }
          `,
        })
        .then(r => r.expectNoGraphQLErrors());
    }

    await db.pool.query(psql`
    UPDATE "schema_versions"
    SET
      "graph_id" = NULL
      , "graph_metadata" = NULL
    WHERE "target_id" = ${target.id}
    `);

    const createContractResult = await createContract(
      {
        target: { byId: target.id },
        contractName: 'public',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['public'],
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());
    expect(createContractResult.createContract.error).toBeNull();

    for (const commit of ['linked-1', 'linked-2']) {
      await token
        .publishSchema({
          commit,
          service: 'products',
          url: 'http://products.com',
          sdl: `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              ${commit.replace('-', '_')}: String @tag(name: "public")
            }
          `,
        })
        .then(r => r.expectNoGraphQLErrors());
    }

    const commits: Array<string | null> = [];
    let after: string | null = null;
    let result: DocumentType<typeof PaginatedSchemaVersionsQuery>;

    do {
      result = await execute({
        document: PaginatedSchemaVersionsQuery,
        authToken: token.secret,
        variables: {
          targetRef: { byId: target.id },
          first: 1,
          after,
        },
      }).then(r => r.expectNoGraphQLErrors());

      const connection = result.target?.schemaVersions;
      assertNonNullish(connection);
      expect(connection.edges).toHaveLength(1);

      commits.push(connection.edges[0].node.meta?.commit ?? null);
      after = connection.pageInfo.endCursor;
      if (!connection.pageInfo.hasNextPage) {
        break;
      }
    } while (after);

    expect(commits).toEqual(['linked-2', 'linked-1', 'legacy-2', 'legacy-1']);
    expect(new Set(commits).size).toBe(commits.length);
  },
);

test.concurrent(
  'schema version by commit returns latest schema for the commit',
  async ({ expect }) => {
    const commit = 'tiny-test-0';
    const schema = /* GraphQL */ `
      type Query {
        ping: String
      }
    `;
    const latestSchema = /* GraphQL */ `
      type Query {
        ping: String
        pong: String
      }
    `;
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Single);

    const token = await createTargetAccessToken({
      mode: 'readWrite',
    });

    await token
      .publishSchema({
        sdl: schema,
        commit,
      })
      .then(r => r.expectNoGraphQLErrors());

    await token
      .publishSchema({
        sdl: latestSchema,
        commit,
      })
      .then(r => r.expectNoGraphQLErrors());

    const result = await execute({
      document: SchemaByCommitQuery,
      token: token.secret,
      variables: {
        commit,
        targetRef: { byId: target.id },
      },
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.schemaVersionByCommit?.sdl).toIncludeSubstringWithoutWhitespace(latestSchema);
  },
);

test.concurrent(
  'correct schema version is returned for commit being used multiple times in the same project in different targets',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target, createTarget } = await createProject(
      ProjectType.Single,
    );
    const commit = 'shared-commit-hash';
    const targetToken = await createTargetAccessToken({});
    await targetToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            a: String!
          }
        `,
        commit,
      })
      .then(r => r.expectNoGraphQLErrors());
    const createOtherTargetResult = await createTarget().then(r => r.expectNoGraphQLErrors());
    const otherTarget = createOtherTargetResult.createTarget.ok?.createdTarget;
    assertNonNullish(otherTarget, 'Target should be created');
    const otherTargetToken = await createTargetAccessToken({
      target: otherTarget,
    });
    await otherTargetToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            b: String!
          }
        `,
        commit,
      })
      .then(r => r.expectNoGraphQLErrors());

    const targetResult = await execute({
      document: SchemaByCommitQuery,
      token: targetToken.secret,
      variables: {
        commit,
        targetRef: { byId: target.id },
      },
    }).then(r => r.expectNoGraphQLErrors());
    expect(targetResult.schemaVersionByCommit?.sdl).toMatchInlineSnapshot(`
      type Query {
        a: String!
      }
    `);

    const otherTargetResult = await execute({
      document: SchemaByCommitQuery,
      token: otherTargetToken.secret,
      variables: {
        commit,
        targetRef: { byId: otherTarget.id },
      },
    }).then(r => r.expectNoGraphQLErrors());
    expect(otherTargetResult.schemaVersionByCommit?.sdl).toMatchInlineSnapshot(`
      type Query {
        b: String!
      }
    `);
  },
);

test.concurrent(
  'valid monolith schema ignores the schema composition auto fix',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Single);
    const token = await createTargetAccessToken({});

    const sdl = /* GraphQL */ `
      schema {
        query: RootQueryType
      }

      type Link {
        link: String
      }

      type RootQueryType {
        foo: Link
      }
    `;

    await token
      .publishSchema({
        sdl,
      })
      .then(r => r.expectNoGraphQLErrors());

    const schema = await token.fetchLatestValidSchema();

    expect(schema.latestValidVersion?.sdl).toMatchInlineSnapshot(sdl);
  },
);

const LatestValidVersionServiceNamesQuery = graphql(/* GraphQL */ `
  query LatestValidVersionServiceNamesQuery($selector: TargetSelectorInput!) {
    target(reference: { bySelector: $selector }) {
      latestValidSchemaVersion {
        id
        serviceNames
      }
    }
  }
`);

test.concurrent(
  'serviceNames lists the services of a version, lowercased and sorted',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(
      ProjectType.Federation,
    );
    const token = await createTargetAccessToken({});

    // Published out of order and with mixed case; the field normalises both.
    for (const [service, sdl] of [
      ['users', 'type Query { users: [String!]! }'],
      ['Products', 'type Query { products: [String!]! }'],
    ] as const) {
      const result = await token
        .publishSchema({ service, url: `https://api.com/${service}`, sdl })
        .then(r => r.expectNoGraphQLErrors());
      expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    }

    const result = await execute({
      document: LatestValidVersionServiceNamesQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.target?.latestValidSchemaVersion?.serviceNames).toEqual(['products', 'users']);
  },
);

test.concurrent('serviceNames is null for a single-schema project', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);
  const token = await createTargetAccessToken({});

  const publishResult = await token
    .publishSchema({ sdl: 'type Query { ping: String }' })
    .then(r => r.expectNoGraphQLErrors());
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const result = await execute({
    document: LatestValidVersionServiceNamesQuery,
    variables: {
      selector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
    },
    authToken: ownerToken,
  }).then(r => r.expectNoGraphQLErrors());

  expect(result.target?.latestValidSchemaVersion?.serviceNames).toBeNull();
});
