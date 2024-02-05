/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert';
import { describe, test } from 'node:test';
import { sql } from 'slonik';
import { createStorage, HiveSchemaChangeModel } from '../../services/storage/src/index';
import { initMigrationTestingEnvironment } from './utils/testkit';

describe('schema check purging', async () => {
  test('purge schema check and related SDL store data related for single schema check', async () => {
    const { db, complete, done, seed, connectionString } = await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      // Run all migrations
      await complete();

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const user = await seed.user({
        user: {
          name: 'test',
          email: 'test@test.com',
        },
      });
      const organization = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO organizations (clean_id, name, user_id) VALUES ('org-1', 'org-1', ${user.id}) RETURNING id;`,
      );
      const project = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO projects (clean_id, name, type, org_id) VALUES ('proj-1', 'proj-1', 'FEDERATION', ${organization.id}) RETURNING id;`,
      );
      const target = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO targets (clean_id, name, project_id) VALUES ('proj-1', 'proj-1', ${project.id}) RETURNING id;`,
      );

      const expiresAt = new Date();

      await storage.createSchemaCheck({
        expiresAt,
        targetId: target.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename }',
        supergraphSDL: '{ __typename }',
        compositeSchemaSDL: '{ __typename }',
        safeSchemaChanges: null,
        breakingSchemaChanges: null,
        isSuccess: true,
        isManuallyApproved: false,
        contextId: null,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      let schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 1, 'Schema check count after creating schema check');

      let sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 1, 'SDL store count after creating schema check');

      await storage.purgeExpiredSchemaChecks({
        expiresAt,
      });

      schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 0, 'Schema check count after purge');

      sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 0, 'SDL store count after purge');
    } finally {
      await done();
      await storage.destroy();
    }
  });

  test('only purge schema check and SDL store data related to expired schema check', async () => {
    const { db, complete, done, seed, connectionString } = await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      // Run all migrations
      await complete();

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const user = await seed.user({
        user: {
          name: 'test',
          email: 'test@test.com',
        },
      });
      const organization = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO organizations (clean_id, name, user_id) VALUES ('org-1', 'org-1', ${user.id}) RETURNING id;`,
      );
      const project = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO projects (clean_id, name, type, org_id) VALUES ('proj-1', 'proj-1', 'FEDERATION', ${organization.id}) RETURNING id;`,
      );
      const target = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO targets (clean_id, name, project_id) VALUES ('proj-1', 'proj-1', ${project.id}) RETURNING id;`,
      );

      const expiresAt = new Date();

      await storage.createSchemaCheck({
        expiresAt,
        targetId: target.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename }',
        supergraphSDL: '{ __typename }',
        compositeSchemaSDL: '{ __typename }',
        safeSchemaChanges: null,
        breakingSchemaChanges: null,
        isSuccess: true,
        isManuallyApproved: false,
        contextId: null,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      await storage.createSchemaCheck({
        expiresAt: new Date(expiresAt.getTime() + 10_000),
        targetId: target.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename1 }',
        supergraphSDL: '{ __typename1 }',
        compositeSchemaSDL: '{ __typename1 }',
        safeSchemaChanges: null,
        breakingSchemaChanges: null,
        isSuccess: true,
        isManuallyApproved: false,
        contextId: null,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      let schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 2, 'Schema check count after creating schema check');

      let sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 2, 'SDL store count after creating schema check');

      await storage.purgeExpiredSchemaChecks({
        expiresAt,
      });

      schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 1, 'Schema check count after purge');

      sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 1, 'SDL store count after purge');
    } finally {
      await done();
      await storage.destroy();
    }
  });

  test('only purge SDL store data that is not referenced by any schema check', async () => {
    const { db, complete, done, seed, connectionString } = await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      // Run all migrations
      await complete();

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const user = await seed.user({
        user: {
          name: 'test',
          email: 'test@test.com',
        },
      });
      const organization = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO organizations (clean_id, name, user_id) VALUES ('org-1', 'org-1', ${user.id}) RETURNING id;`,
      );
      const project = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO projects (clean_id, name, type, org_id) VALUES ('proj-1', 'proj-1', 'FEDERATION', ${organization.id}) RETURNING id;`,
      );
      const target = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO targets (clean_id, name, project_id) VALUES ('proj-1', 'proj-1', ${project.id}) RETURNING id;`,
      );

      const expiresAt = new Date();

      await storage.createSchemaCheck({
        expiresAt,
        targetId: target.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename }',
        supergraphSDL: '{ __typename1 }',
        compositeSchemaSDL: '{ __typename1 }',
        safeSchemaChanges: null,
        breakingSchemaChanges: null,
        isSuccess: true,
        isManuallyApproved: false,
        contextId: null,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      await storage.createSchemaCheck({
        expiresAt: new Date(expiresAt.getTime() + 10_000),
        targetId: target.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename1 }',
        supergraphSDL: '{ __typename1 }',
        compositeSchemaSDL: '{ __typename1 }',
        safeSchemaChanges: null,
        breakingSchemaChanges: null,
        isSuccess: true,
        isManuallyApproved: false,
        contextId: null,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      let schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 2, 'Schema check count after creating schema check');

      let sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 2, 'SDL store count after creating schema check');

      await storage.purgeExpiredSchemaChecks({
        expiresAt,
      });

      schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 1, 'Schema check count after purge');

      sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 1, 'SDL store count after purge');
    } finally {
      await done();
      await storage.destroy();
    }
  });

  test("don't purge approved schema changes that are no longer referenced by any schema check with same targetId and contextId", async () => {
    const { db, complete, done, seed, connectionString } = await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      // Run all migrations
      await complete();

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const user = await seed.user({
        user: {
          name: 'test',
          email: 'test@test.com',
        },
      });
      const organization = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO organizations (clean_id, name, user_id) VALUES ('org-1', 'org-1', ${user.id}) RETURNING id;`,
      );
      const project = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO projects (clean_id, name, type, org_id) VALUES ('proj-1', 'proj-1', 'FEDERATION', ${organization.id}) RETURNING id;`,
      );
      const target = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO targets (clean_id, name, project_id) VALUES ('proj-1', 'proj-1', ${project.id}) RETURNING id;`,
      );

      const expiresAt = new Date();
      const expiresAt2 = new Date(expiresAt.getTime() + 10_000);
      const contextId = 'context-id';

      const failedSchemaCheck = await storage.createSchemaCheck({
        expiresAt,
        targetId: target.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename }',
        supergraphSDL: '{ __typename1 }',
        compositeSchemaSDL: '{ __typename1 }',
        safeSchemaChanges: null,
        breakingSchemaChanges: [
          HiveSchemaChangeModel.parse({
            type: 'TYPE_REMOVED',
            meta: {
              removedTypeName: 'Type1',
            },
            isSafeBasedOnUsage: false,
          }),
        ],
        isSuccess: false,
        isManuallyApproved: false,
        contextId,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      await storage.createSchemaCheck({
        expiresAt: expiresAt2,
        targetId: target.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename1 }',
        supergraphSDL: '{ __typename1 }',
        compositeSchemaSDL: '{ __typename1 }',
        safeSchemaChanges: null,
        breakingSchemaChanges: null,
        isSuccess: true,
        isManuallyApproved: false,
        contextId,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      let schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 2, 'Schema check count after creating schema check');

      let sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 2, 'SDL store count after creating schema check');

      let schemaChangeApprovalCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_change_approvals`,
      );
      assert.equal(
        schemaChangeApprovalCount,
        0,
        'schema change approval count after creating schema check',
      );

      await storage.approveFailedSchemaCheck({
        schemaCheckId: failedSchemaCheck.id,
        userId: user.id,
        contracts: {
          approveContractChecksForSchemaCheckId() {
            return Promise.resolve(false);
          },
        } as any,
      });

      schemaChangeApprovalCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_change_approvals`,
      );
      assert.equal(
        schemaChangeApprovalCount,
        1,
        'schema change approval count after approving schema check',
      );

      await storage.purgeExpiredSchemaChecks({
        expiresAt,
      });

      schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 1, 'Schema check count after purge');

      sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 1, 'SDL store count after purge');

      schemaChangeApprovalCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_change_approvals`,
      );
      assert.equal(schemaChangeApprovalCount, 1, 'schema change approval count after purge');

      await storage.purgeExpiredSchemaChecks({
        expiresAt: expiresAt2,
      });

      schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 0, 'Schema check count after second purge');

      sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 0, 'SDL store count after second purge');

      schemaChangeApprovalCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_change_approvals`,
      );
      assert.equal(schemaChangeApprovalCount, 0, 'schema change approval count after second purge');
    } finally {
      await done();
      await storage.destroy();
    }
  });

  test('purge approved schema changes that are no longer referenced by any targetId and contextId', async () => {
    const { db, complete, done, seed, connectionString } = await initMigrationTestingEnvironment();
    const storage = await createStorage(connectionString, 1);
    try {
      // Run all migrations
      await complete();

      // Seed the database with some data (schema_sdl, supergraph_sdl, composite_schema_sdl)
      const user = await seed.user({
        user: {
          name: 'test',
          email: 'test@test.com',
        },
      });
      const organization = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO organizations (clean_id, name, user_id) VALUES ('org-1', 'org-1', ${user.id}) RETURNING id;`,
      );
      const project = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO projects (clean_id, name, type, org_id) VALUES ('proj-1', 'proj-1', 'FEDERATION', ${organization.id}) RETURNING id;`,
      );
      const target = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO targets (clean_id, name, project_id) VALUES ('proj-1', 'proj-1', ${project.id}) RETURNING id;`,
      );
      const target2 = await db.one<{
        id: string;
      }>(
        sql`INSERT INTO targets (clean_id, name, project_id) VALUES ('proj-1-1', 'proj-1', ${project.id}) RETURNING id;`,
      );

      const expiresAt = new Date();
      const expiresAt2 = new Date(expiresAt.getTime() + 10_000);
      const contextId = 'context-id';

      const failedSchemaCheck = await storage.createSchemaCheck({
        expiresAt,
        targetId: target.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename }',
        supergraphSDL: '{ __typename1 }',
        compositeSchemaSDL: '{ __typename1 }',
        safeSchemaChanges: null,
        breakingSchemaChanges: [
          HiveSchemaChangeModel.parse({
            type: 'TYPE_REMOVED',
            meta: {
              removedTypeName: 'Type1',
            },
            isSafeBasedOnUsage: false,
          }),
        ],
        isSuccess: false,
        isManuallyApproved: false,
        contextId,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      await storage.createSchemaCheck({
        expiresAt: expiresAt2,
        targetId: target2.id,
        serviceName: 'service',
        schemaVersionId: null,
        schemaSDL: '{ __typename1 }',
        supergraphSDL: '{ __typename1 }',
        compositeSchemaSDL: '{ __typename1 }',
        safeSchemaChanges: null,
        breakingSchemaChanges: null,
        isSuccess: true,
        isManuallyApproved: false,
        contextId,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        meta: null,
        contracts: null,
        githubCheckRunId: null,
        githubRepository: null,
        githubSha: null,
        manualApprovalUserId: null,
        schemaPolicyWarnings: null,
      });

      let schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 2, 'Schema check count after creating schema check');

      let sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 2, 'SDL store count after creating schema check');

      let schemaChangeApprovalCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_change_approvals`,
      );
      assert.equal(
        schemaChangeApprovalCount,
        0,
        'schema change approval count after creating schema check',
      );

      await storage.approveFailedSchemaCheck({
        schemaCheckId: failedSchemaCheck.id,
        userId: user.id,
        contracts: {
          approveContractChecksForSchemaCheckId() {
            return Promise.resolve(false);
          },
        } as any,
      });

      schemaChangeApprovalCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_change_approvals`,
      );
      assert.equal(
        schemaChangeApprovalCount,
        1,
        'schema change approval count after approving schema check',
      );

      await storage.purgeExpiredSchemaChecks({
        expiresAt,
      });

      schemaCheckCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_checks`,
      );
      assert.equal(schemaCheckCount, 1, 'Schema check count after purge');

      sdlStoreCount = await db.oneFirst<number>(sql`SELECT count(*) as total FROM sdl_store`);
      assert.equal(sdlStoreCount, 1, 'SDL store count after purge');

      schemaChangeApprovalCount = await db.oneFirst<number>(
        sql`SELECT count(*) as total FROM schema_change_approvals`,
      );
      assert.equal(schemaChangeApprovalCount, 0, 'schema change approval count after purge');
    } finally {
      await done();
      await storage.destroy();
    }
  });
});
