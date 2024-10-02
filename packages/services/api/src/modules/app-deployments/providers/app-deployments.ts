import { Inject, Injectable, Scope } from 'graphql-modules';
import { sql, UniqueIntegrityConstraintViolationError, type DatabasePool } from 'slonik';
import { z } from 'zod';
import { buildAppDeploymentIsEnabledKey } from '@hive/cdn-script/artifact-storage-reader';
import {
  decodeCreatedAtAndUUIDIdBasedCursor,
  decodeHashBasedCursor,
  encodeCreatedAtAndUUIDIdBasedCursor,
  encodeHashBasedCursor,
} from '@hive/storage';
import { ClickHouse, sql as cSql } from '../../operations/providers/clickhouse-client';
import { SchemaVersionHelper } from '../../schema/providers/schema-version-helper';
import { Logger } from '../../shared/providers/logger';
import { PG_POOL_CONFIG } from '../../shared/providers/pg-pool';
import { S3_CONFIG, type S3Config } from '../../shared/providers/s3-config';
import { Storage } from '../../shared/providers/storage';
import { APP_DEPLOYMENTS_ENABLED } from './app-deployments-enabled-token';
import { PersistedDocumentScheduler } from './persisted-document-scheduler';

const AppDeploymentNameModel = z
  .string()
  .min(1, 'Must be at least 1 character long')
  .max(64, 'Must be at most 64 characters long')
  .regex(/^[a-zA-Z0-9_-]+$/, "Can only contain letters, numbers, '_', and '-'");

const AppDeploymentVersionModel = z
  .string()
  .trim()
  .min(1, 'Must be at least 1 character long')
  .max(64, 'Must be at most 64 characters long')
  .regex(/^[a-zA-Z0-9._-]+$/, "Can only contain letters, numbers, '.', '_', and '-'");

const noAccessToAppDeploymentsMessage =
  'This organization has no access to app deployments. Please contact the Hive team for early access.';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AppDeployments {
  private logger: Logger;

  constructor(
    logger: Logger,
    @Inject(PG_POOL_CONFIG) private pool: DatabasePool,
    @Inject(S3_CONFIG) private s3: S3Config,
    private clickhouse: ClickHouse,
    private storage: Storage,
    private schemaVersionHelper: SchemaVersionHelper,
    private persistedDocumentScheduler: PersistedDocumentScheduler,
    @Inject(APP_DEPLOYMENTS_ENABLED) private appDeploymentsEnabled: Boolean,
  ) {
    this.logger = logger.child({ source: 'AppDeployments' });
  }

  async findAppDeployment(args: {
    targetId: string;
    name: string;
    version: string;
  }): Promise<AppDeploymentRecord | null> {
    this.logger.debug(
      'find app deployment (targetId=%s, appName=%s, appVersion=%s)',
      args.targetId,
      args.name,
      args.version,
    );

    const record = await this.pool.maybeOne<unknown>(
      sql`
        SELECT
          ${appDeploymentFields}
        FROM
          "app_deployments"
        WHERE
          "target_id" = ${args.targetId}
          AND "name" = ${args.name}
          AND "version" = ${args.version}
      `,
    );

    if (record === null) {
      this.logger.debug(
        'no app deployment found (targetId=%s, appName=%s, appVersion=%s)',
        args.targetId,
        args.name,
        args.version,
      );
      return null;
    }

    const appDeployment = AppDeploymentModel.parse(record);

    this.logger.debug(
      'app deployment found (targetId=%s, appName=%s, appVersion=%s, deploymentId=%s)',
      args.targetId,
      args.name,
      args.version,
      appDeployment.id,
    );

    return appDeployment;
  }

  async createAppDeployment(args: {
    organizationId: string;
    targetId: string;
    appDeployment: {
      name: string;
      version: string;
    };
  }) {
    this.logger.debug(
      'create app deployment (targetId=%s, appName=%s, appVersion=%s)',
      args.targetId,
      args.appDeployment.name,
      args.appDeployment.version,
    );

    if (this.appDeploymentsEnabled === false) {
      const organization = await this.storage.getOrganization({
        organization: args.organizationId,
      });
      if (organization.featureFlags.appDeployments === false) {
        this.logger.debug(
          'organization has no access to app deployments (targetId=%s, appName=%s, appVersion=%s)',
          args.targetId,
          args.appDeployment.name,
          args.appDeployment.version,
        );
        return {
          type: 'error' as const,
          error: {
            message: noAccessToAppDeploymentsMessage,
            details: null,
          },
        };
      }
    }

    const nameValidationResult = AppDeploymentNameModel.safeParse(args.appDeployment.name);
    const versionValidationResult = AppDeploymentVersionModel.safeParse(args.appDeployment.version);

    if (nameValidationResult.success === false || versionValidationResult.success === false) {
      this.logger.debug(
        'app deployment input validation failed (targetId=%s, appName=%s, appVersion=%s)',
        args.targetId,
        args.appDeployment.name,
        args.appDeployment.version,
      );
      return {
        type: 'error' as const,
        error: {
          message: 'Invalid input',
          details: {
            appName: nameValidationResult.error?.issues[0].message ?? null,
            appVersion: versionValidationResult.error?.issues[0].message ?? null,
          },
        },
      };
    }

    try {
      const result = await this.pool.maybeOne(
        sql`
          INSERT INTO "app_deployments" (
            "target_id"
            , "name"
            , "version"
          )
          VALUES (
            ${args.targetId}
            , ${args.appDeployment.name}
            , ${args.appDeployment.version}
          )
          RETURNING
            ${appDeploymentFields}
        `,
      );

      if (result === null) {
        return {
          type: 'error' as const,
          error: {
            message: 'App deployment already exists',
            details: null,
          },
        };
      }

      return {
        type: 'success' as const,
        appDeployment: AppDeploymentModel.parse(result),
      };
    } catch (err) {
      if (err instanceof UniqueIntegrityConstraintViolationError) {
        const appDeployment = await this.findAppDeployment({
          targetId: args.targetId,
          name: args.appDeployment.name,
          version: args.appDeployment.version,
        });

        if (!appDeployment) {
          throw new Error('Invalid state. app deployment not found after insert failed');
        }

        // In case the deployment already exists, we return the existing deployment.
        // That makes re-running CI/CD pipelines easier for re-deployments of older apps.
        // The CLI/Clients that try to publish a deployment should check the app deployment status
        // and not try to send documents if the status is 'active'

        return {
          type: 'success' as const,
          appDeployment,
        };
      }

      throw err;
    }
  }

  async addDocumentsToAppDeployment(args: {
    organizationId: string;
    projectId: string;
    targetId: string;
    appDeployment: {
      name: string;
      version: string;
    };
    operations: ReadonlyArray<{
      hash: string;
      body: string;
    }>;
  }) {
    if (this.appDeploymentsEnabled === false) {
      const organization = await this.storage.getOrganization({
        organization: args.organizationId,
      });
      if (organization.featureFlags.appDeployments === false) {
        this.logger.debug(
          'organization has no access to app deployments (targetId=%s, appName=%s, appVersion=%s)',
        );

        return {
          type: 'error' as const,
          error: {
            message: noAccessToAppDeploymentsMessage,
            details: null,
          },
        };
      }
    }

    // todo: validate input

    const appDeployment = await this.findAppDeployment({
      targetId: args.targetId,
      name: args.appDeployment.name,
      version: args.appDeployment.version,
    });

    if (appDeployment === null) {
      return {
        type: 'error' as const,
        error: {
          message: 'App deployment not found',
          details: null,
        },
      };
    }

    if (appDeployment.activatedAt !== null) {
      return {
        type: 'error' as const,
        error: {
          message: 'App deployment has already been activated and is locked for modifications',
          details: null,
        },
      };
    }

    if (args.operations.length !== 0) {
      const latestSchemaVersion = await this.storage.getMaybeLatestValidVersion({
        target: args.targetId,
      });

      if (latestSchemaVersion === null) {
        return {
          type: 'error' as const,
          error: {
            // TODO: better error message with links to docs
            message: 'No schema has been published yet',
            details: null,
          },
        };
      }

      const compositeSchemaSdl = await this.schemaVersionHelper.getCompositeSchemaSdl({
        ...latestSchemaVersion,
        organization: args.organizationId,
        project: args.projectId,
        target: args.targetId,
      });
      if (compositeSchemaSdl === null) {
        // No valid schema found.
        return {
          type: 'error' as const,
          error: {
            message: 'Composite schema not found',
            details: null,
          },
        };
      }

      const result = await this.persistedDocumentScheduler.processBatch({
        schemaSdl: compositeSchemaSdl,
        targetId: args.targetId,
        appDeployment: {
          id: appDeployment.id,
          name: args.appDeployment.name,
          version: args.appDeployment.version,
        },
        documents: args.operations,
      });

      if (result.type === 'error') {
        return {
          type: 'error' as const,
          error: result.error,
        };
      }
    }

    return {
      type: 'success' as const,
      appDeployment,
    };
  }

  async activateAppDeployment(args: {
    organizationId: string;
    targetId: string;
    appDeployment: {
      name: string;
      version: string;
    };
  }) {
    this.logger.debug('activate app deployment (targetId=%s, appName=%s, appVersion=%s)');

    if (this.appDeploymentsEnabled === false) {
      const organization = await this.storage.getOrganization({
        organization: args.organizationId,
      });
      if (organization.featureFlags.appDeployments === false) {
        this.logger.debug(
          'organization has no access to app deployments (targetId=%s, appName=%s, appVersion=%s)',
        );

        return {
          type: 'error' as const,
          message: noAccessToAppDeploymentsMessage,
        };
      }
    }

    const appDeployment = await this.findAppDeployment({
      targetId: args.targetId,
      name: args.appDeployment.name,
      version: args.appDeployment.version,
    });

    if (appDeployment === null) {
      this.logger.debug(
        'activate app deployment failed as it does not exist. (targetId=%s, appName=%s, appVersion=%s)',
      );
      return {
        type: 'error' as const,
        message: 'App deployment not found',
      };
    }

    if (appDeployment.retiredAt !== null) {
      this.logger.debug(
        'app deployment is already retired. (targetId=%s, appName=%s, appVersion=%s)',
      );

      return {
        type: 'error' as const,
        message: 'App deployment is retired',
      };
    }

    if (appDeployment.activatedAt !== null) {
      this.logger.debug(
        'app deployment is already active. (targetId=%s, appName=%s, appVersion=%s)',
      );

      return {
        type: 'success' as const,
        isSkipped: true,
        appDeployment,
      };
    }

    for (const s3 of this.s3) {
      const result = await s3.client.fetch(
        [
          s3.endpoint,
          s3.bucket,
          buildAppDeploymentIsEnabledKey(
            appDeployment.targetId,
            appDeployment.name,
            appDeployment.version,
          ),
        ].join('/'),
        {
          method: 'PUT',
          body: '1',
          headers: {
            'content-type': 'text/plain',
          },
          aws: {
            signQuery: true,
          },
        },
      );

      if (result.statusCode !== 200) {
        throw new Error(`Failed to enable app deployment: ${result.statusMessage}`);
      }
    }

    const updatedAppDeployment = await this.pool
      .maybeOne(
        sql`
          UPDATE
            "app_deployments"
          SET
            "activated_at" = NOW()
          WHERE
            "id" = ${appDeployment.id}
          RETURNING
            ${appDeploymentFields}
        `,
      )
      .then(result => AppDeploymentModel.parse(result));

    await this.clickhouse.query({
      query: cSql`
        INSERT INTO "app_deployments" (
          "target_id"
          , "app_deployment_id"
          , "app_name"
          , "app_version"
          , "is_active"
        )
        VALUES (
          ${appDeployment.targetId}
          , ${appDeployment.id}
          , ${appDeployment.name}
          , ${appDeployment.version}
          , True
        );
      `,
      timeout: 10000,
      queryId: 'app-deployment-activate',
    });

    this.logger.debug(
      'activate app deployment succeeded. (targetId=%s, appName=%s, appVersion=%s)',
    );

    return {
      type: 'success' as const,
      isSkipped: false,
      appDeployment: updatedAppDeployment,
    };
  }

  async retireAppDeployment(args: {
    organizationId: string;
    targetId: string;
    appDeployment: {
      name: string;
      version: string;
    };
  }) {
    this.logger.debug('activate app deployment (targetId=%s, appName=%s, appVersion=%s)');

    if (this.appDeploymentsEnabled === false) {
      const organization = await this.storage.getOrganization({
        organization: args.organizationId,
      });
      if (organization.featureFlags.appDeployments === false) {
        this.logger.debug(
          'organization has no access to app deployments (targetId=%s, appName=%s, appVersion=%s)',
        );

        return {
          type: 'error' as const,
          message: noAccessToAppDeploymentsMessage,
        };
      }
    }

    const appDeployment = await this.findAppDeployment({
      targetId: args.targetId,
      name: args.appDeployment.name,
      version: args.appDeployment.version,
    });

    if (appDeployment === null) {
      this.logger.debug(
        'activate app deployment failed as it does not exist. (targetId=%s, appName=%s, appVersion=%s)',
        args.targetId,
        args.appDeployment.name,
        args.appDeployment.version,
      );
      return {
        type: 'error' as const,
        message: 'App deployment not found',
      };
    }

    if (appDeployment.activatedAt === null) {
      this.logger.debug(
        'activate app deployment failed as it was never active. (targetId=%s, appDeploymentId=%s)',
        args.targetId,
        appDeployment.id,
      );
      return {
        type: 'error' as const,
        message: 'App deployment is not active',
      };
    }

    if (appDeployment.retiredAt !== null) {
      this.logger.debug(
        'activate app deployment failed as it is already retired. (targetId=%s, appDeploymentId=%s)',
        args.targetId,
        appDeployment.id,
      );

      return {
        type: 'error' as const,
        message: 'App deployment is already retired',
      };
    }

    for (const s3 of this.s3) {
      const result = await s3.client.fetch(
        [
          s3.endpoint,
          s3.bucket,
          buildAppDeploymentIsEnabledKey(
            appDeployment.targetId,
            appDeployment.name,
            appDeployment.version,
          ),
        ].join('/'),
        {
          method: 'DELETE',
          aws: {
            signQuery: true,
          },
        },
      );

      /** We receive a 204 status code if the DELETE operation was successful */
      if (result.statusCode !== 204) {
        this.logger.error(
          'Failed to disable app deployment (organizationId=%s, targetId=%s, appDeploymentId=%s, statusCode=%s)',
          args.organizationId,
          args.targetId,
          appDeployment.id,
          result.statusCode,
        );
        throw new Error(
          `Failed to disable app deployment. Request failed with status code "${result.statusMessage}".`,
        );
      }
    }

    await this.clickhouse.query({
      query: cSql`
        INSERT INTO "app_deployments" (
          "target_id"
          , "app_deployment_id"
          , "app_name"
          , "app_version"
          , "is_active"
        )
        VALUES (
          ${appDeployment.targetId}
          , ${appDeployment.id}
          , ${appDeployment.name}
          , ${appDeployment.version}
          , False
        );
      `,
      timeout: 10000,
      queryId: 'app-deployment-activate',
    });

    const updatedAppDeployment = await this.pool
      .one(
        sql`
          UPDATE
            "app_deployments"
          SET
            "retired_at" = NOW()
          WHERE
            "id" = ${appDeployment.id}
          RETURNING
            ${appDeploymentFields}
        `,
      )
      .then(result => AppDeploymentModel.parse(result));

    this.logger.debug(
      'retire app deployment succeeded. (targetId=%s, appName=%s, appVersion=%s, appDeploymentId=%s)',
      args.targetId,
      args.appDeployment.name,
      args.appDeployment.version,
      appDeployment.id,
    );

    return {
      type: 'success' as const,
      appDeployment: updatedAppDeployment,
    };
  }

  async getPaginatedAppDeployments(args: {
    targetId: string;
    cursor: string | null;
    first: number | null;
  }) {
    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const cursor = args.cursor ? decodeCreatedAtAndUUIDIdBasedCursor(args.cursor) : null;

    const result = await this.pool.query<unknown>(sql`
      SELECT
        ${appDeploymentFields}
      FROM
        "app_deployments"
      WHERE
        "target_id" = ${args.targetId}
        ${
          cursor
            ? sql`
                AND (
                  (
                    "created_at" = ${cursor.createdAt}
                    AND "id" < ${cursor.id}
                  )
                  OR "created_at" < ${cursor.createdAt}
                )
              `
            : sql``
        }
      ORDER BY "created_at" DESC, "id"
      LIMIT ${limit + 1}
    `);

    let items = result.rows.map(row => {
      const node = AppDeploymentModel.parse(row);

      return {
        cursor: encodeCreatedAtAndUUIDIdBasedCursor(node),
        node,
      };
    });

    const hasNextPage = items.length > limit;

    items = items.slice(0, limit);

    return {
      edges: items,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: cursor !== null,
        endCursor: items[items.length - 1]?.cursor ?? '',
        startCursor: items[0]?.cursor ?? '',
      },
    };
  }

  async getPaginatedGraphQLDocuments(args: {
    appDeploymentId: string;
    cursor: string | null;
    first: number | null;
  }) {
    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const cursor = args.cursor ? decodeHashBasedCursor(args.cursor) : null;
    const result = await this.clickhouse.query({
      query: cSql`
        SELECT
          "app_deployment_documents"."document_hash" AS "hash"
          , "app_deployment_documents"."document_body" AS "body"
          , "app_deployment_documents"."operation_name" AS "operationName"
          , "app_deployment_documents"."hash" AS "internalHash"
        FROM
          "app_deployment_documents"
        WHERE
          "app_deployment_id" = ${args.appDeploymentId}
          ${cursor?.id ? cSql`AND "document_hash" > ${cursor.id}` : cSql``}
        ORDER BY "app_deployment_id", "document_hash"
        LIMIT 1 BY "app_deployment_id", "document_hash"
        LIMIT ${cSql.raw(String(limit + 1))}
      `,
      queryId: 'get-paginated-graphql-documents',
      timeout: 20_000,
    });

    let items = result.data.map(row => {
      const node = GraphQLDocumentModel.parse(row);

      return {
        cursor: encodeHashBasedCursor({ id: node.hash }),
        node,
      };
    });

    const hasNextPage = items.length > limit;

    items = items.slice(0, limit);

    return {
      edges: items,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: cursor !== null,
        endCursor: items[items.length - 1]?.cursor ?? '',
        startCursor: items[0]?.cursor ?? '',
      },
    };
  }

  async getDocumentCountForAppDeployments(args: { appDeploymentIds: Array<string> }) {
    const result = await this.clickhouse.query({
      query: cSql`
        SELECT
          "app_deployment_id" AS "appDeploymentId"
          , count() AS "count"
        FROM
          "app_deployment_documents"
        WHERE
          "app_deployment_id" IN (${cSql.array(args.appDeploymentIds, 'String')})
        GROUP BY
          "app_deployment_id"
      `,
      queryId: 'get-document-count-for-app-deployments',
      timeout: 20_000,
    });

    const model = z.array(
      z.object({
        appDeploymentId: z.string(),
        count: z.string().transform(str => parseInt(str, 10)),
      }),
    );

    return model.parse(result.data);
  }

  async getLastUsedForAppDeployments(args: { appDeploymentIds: Array<string> }) {
    const result = await this.clickhouse.query({
      query: cSql`
        SELECT
          "filtered_app_deployments"."app_deployment_id" AS "appDeploymentId"
          , formatDateTimeInJodaSyntax(max("app_deployment_usage"."last_request"), 'YYYY-MM-dd\\'T\\'HH:mm:SS.000000+00:00') AS "lastUsed"
        FROM (
          SELECT
            "target_id"
            , "app_deployment_id"
            , "app_name"
            , "app_version"
          FROM
            "app_deployments"
          PREWHERE
            "app_deployment_id" IN (${cSql.array(args.appDeploymentIds, 'String')})
          ORDER BY ("target_id", "app_deployment_id", "app_name", "app_version")
          LIMIT 1 BY "app_deployment_id"
        ) AS "filtered_app_deployments"
        INNER JOIN "app_deployment_usage" ON (
            "filtered_app_deployments"."target_id" = "app_deployment_usage"."target_id"
            AND "filtered_app_deployments"."app_name" = "app_deployment_usage"."app_name"
            AND "filtered_app_deployments"."app_version" = "app_deployment_usage"."app_version"
          )
        GROUP BY "filtered_app_deployments"."app_deployment_id"
      `,
      queryId: 'get-document-count-for-app-deployments',
      timeout: 20_000,
    });

    const model = z.array(
      z.object({
        appDeploymentId: z.string(),
        lastUsed: z.string(),
      }),
    );

    return model.parse(result.data);
  }
}

const appDeploymentFields = sql`
  "id"
  , "target_id" AS "targetId"
  , "name"
  , "version"
  , to_json("created_at") AS "createdAt"
  , to_json("activated_at") AS "activatedAt"
  , to_json("retired_at") AS "retiredAt"
`;

const AppDeploymentModel = z.intersection(
  z.object({
    id: z.string(),
    targetId: z.string(),
    name: z.string(),
    version: z.string(),
    createdAt: z.string(),
  }),
  z.union([
    // This is the case where the deployment is pending
    z.object({
      activatedAt: z.null(),
      retiredAt: z.null(),
    }),
    // This is the case where the deployment is active
    z.object({
      activatedAt: z.string(),
      retiredAt: z.null(),
    }),
    // This is the case where the deployment is retired
    z.object({
      activatedAt: z.string(),
      retiredAt: z.string(),
    }),
  ]),
);

const GraphQLDocumentModel = z.object({
  hash: z.string(),
  body: z.string(),
  operationName: z.string().transform(value => (value === '' ? null : value)),
  internalHash: z.string(),
});

export type AppDeploymentRecord = z.infer<typeof AppDeploymentModel>;

export type GraphQLDocumentRecord = z.infer<typeof GraphQLDocumentModel>;
