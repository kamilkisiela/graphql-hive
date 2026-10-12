import { createContract, deleteContract, schemaVersionPromote } from 'testkit/flow';
import { ProjectType, ResourceAssignmentModeType } from 'testkit/gql/graphql';
import { initSeed } from 'testkit/seed';
import { assertNonNullish } from 'testkit/utils';
import { SchemaVersionStore } from '@hive/api/modules/schema/providers/schema-version-store';
import { psql } from '@hive/postgres';

test.concurrent('creating a target creates its default graph', async ({ expect }) => {
  const seed = initSeed();
  const { createOrg } = await seed.createOwner();
  const { createProject } = await createOrg();
  const { createTarget } = await createProject(ProjectType.Federation);

  const result = await createTarget().then(r => r.expectNoGraphQLErrors());
  const target = result.createTarget.ok?.createdTarget;
  assertNonNullish(target);

  const graphStore = await seed.getGraphStore();
  const graph = await graphStore.findGraphForTargetIdByName(target.id, 'default');

  expect(graph).toMatchObject({
    targetId: target.id,
    name: 'default',
    type: 'BASE',
    config: null,
    sourceGraphId: null,
  });
});

test.concurrent(
  'schema version creation paths (publish; delete; promote) reference the default graph',
  async ({ expect }) => {
    const seed = initSeed();
    const { createOrg } = await seed.createOwner();
    const { createProject, createOrganizationAccessToken } = await createOrg();
    const { target, createTargetAccessToken } = await createProject(ProjectType.Federation);
    const token = await createTargetAccessToken({});
    const graphStore = await seed.getGraphStore();
    const graph = await graphStore.findGraphForTargetIdByName(target.id, 'default');
    assertNonNullish(graph);

    const db = await seed.createDbConnection();
    const schemaVersions = new SchemaVersionStore(db.pool);

    await token
      .publishSchema({
        sdl: 'type Query { ping: String }',
        service: 'service',
        url: 'http://service',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(await schemaVersions.getMaybeLatestSchemaVersionForGraph(graph)).toMatchObject({
      graphId: graph.id,
    });

    const deleteResult = await token.deleteSchema('service').then(r => r.expectNoGraphQLErrors());
    expect(deleteResult.schemaDelete.__typename).toEqual('SchemaDeleteSuccess');

    expect(await schemaVersions.getMaybeLatestSchemaVersionForGraph(graph)).toMatchObject({
      graphId: graph.id,
    });

    const { privateAccessKey } = await createOrganizationAccessToken({
      resources: { mode: ResourceAssignmentModeType.All },
      permissions: ['schemaVersion:promote'],
    });

    const promoteResult = await schemaVersionPromote(
      {
        source: { fromTarget: { byId: target.id } },
        target: { toTarget: { byId: target.id } },
      },
      privateAccessKey,
    ).then(r => r.expectNoGraphQLErrors());
    expect(promoteResult.schemaVersionPromote.error).toEqual(null);

    expect(await schemaVersions.getMaybeLatestSchemaVersionForGraph(graph)).toMatchObject({
      graphId: graph.id,
    });
  },
);

test.concurrent(
  'legacy schema versions resolve to the backfilled base graph',
  async ({ expect }) => {
    const seed = initSeed();
    const { createOrg } = await seed.createOwner();
    const { createProject } = await createOrg();
    const { target, createTargetAccessToken } = await createProject(ProjectType.Federation);
    const token = await createTargetAccessToken({});

    await token
      .publishSchema({
        commit: 'legacy',
        sdl: 'type Query { ping: String }',
        service: 'service',
        url: 'http://service',
      })
      .then(r => r.expectNoGraphQLErrors());

    const graphStore = await seed.getGraphStore();
    const graph = await graphStore.findGraphForTargetIdByName(target.id, 'default');
    assertNonNullish(graph);

    await using db = await seed.createDbConnection();
    const schemaVersions = new SchemaVersionStore(db.pool);
    const version = await schemaVersions.getMaybeLatestSchemaVersionForGraph(graph);
    assertNonNullish(version);

    await db.pool.query(psql`
      UPDATE "graphs"
      SET "is_backfilled" = TRUE
      WHERE "id" = ${graph.id}
    `);
    await db.pool.query(psql`
      UPDATE "schema_versions"
      SET "graph_id" = NULL
      WHERE "id" = ${version.id}
    `);

    const legacyVersion = await schemaVersions.getSchemaVersionById(version.id);
    assertNonNullish(legacyVersion);
    expect(legacyVersion.graphId).toBeNull();

    expect(await graphStore.findGraphForSchemaVersion(legacyVersion)).toMatchObject({
      id: graph.id,
      targetId: target.id,
      type: 'BASE',
      isBackfilled: true,
    });
  },
);

test.concurrent('creating a contract creates its contract graph', async ({ expect }) => {
  const seed = initSeed();
  const { createOrg, ownerToken } = await seed.createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const result = await createContract(
    {
      target: { byId: target.id },
      contractName: 'my-contract',
      includeTags: ['public'],
      removeUnreachableTypesFromPublicApiSchema: true,
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(result.createContract.error).toBeNull();

  const graphStore = await seed.getGraphStore();
  const sourceGraph = await graphStore.findGraphForTargetIdByName(target.id, 'default');
  const contractGraph = await graphStore.findGraphForTargetIdByName(
    target.id,
    'default/my-contract',
  );
  assertNonNullish(sourceGraph);

  expect(contractGraph).toMatchObject({
    targetId: target.id,
    name: 'default/my-contract',
    type: 'CONTRACT',
    sourceGraphId: sourceGraph.id,
    config: {
      includeTags: ['public'],
      excludeTags: null,
      removeUnreachableTypesFromPublicApiSchema: true,
    },
  });
});

test.concurrent('deleting a contract deletes its contract graph', async ({ expect }) => {
  const seed = initSeed();
  const { createOrg, ownerToken } = await seed.createOwner();
  const { createProject } = await createOrg();
  const { target } = await createProject(ProjectType.Federation);

  const createResult = await createContract(
    {
      target: { byId: target.id },
      contractName: 'my-contract',
      removeUnreachableTypesFromPublicApiSchema: false,
      includeTags: ['public'],
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());
  const contract = createResult.createContract.ok?.createdContract;
  assertNonNullish(contract);

  const graphStore = await seed.getGraphStore();
  expect(
    await graphStore.findGraphForTargetIdByName(target.id, 'default/my-contract'),
  ).not.toBeNull();

  const disableResult = await deleteContract(
    {
      contract: {
        byId: contract.id,
      },
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  expect(disableResult.deleteContract.error).toBeNull();
  expect(disableResult.deleteContract.ok?.deletedContractId).to.not.toBeNull();
  expect(await graphStore.findGraphForTargetIdByName(target.id, 'default/my-contract')).toBeNull();
});
