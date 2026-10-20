import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import {
  AppDeploymentManifestModel,
  buildAppDeploymentIsEnabledKey,
  buildAppDeploymentManifestKey,
} from '@hive/cdn-script/artifact-storage-reader';
import {
  PostgresDatabasePool,
  psql,
  UniqueIntegrityConstraintViolationError,
} from '@hive/postgres';
import {
  AffectedAppDeployments,
  decodeAppDeploymentSortCursor,
  decodeCreatedAtAndUUIDIdBasedCursor,
  decodeHashBasedCursor,
  encodeAppDeploymentSortCursor,
  encodeCreatedAtAndUUIDIdBasedCursor,
  encodeHashBasedCursor,
} from '@hive/storage';
import { type Graph } from '../../graph/providers/graph-store';
import { ClickHouse, sql as cSql } from '../../operations/providers/clickhouse-client';
import { SchemaVersionHelper } from '../../schema/providers/schema-version-helper';
import { SchemaVersionStore } from '../../schema/providers/schema-version-store';
import { Logger } from '../../shared/providers/logger';
import { S3Writer } from '../../shared/providers/s3-writer';
import { Storage } from '../../shared/providers/storage';
import { TargetStore } from '../../target/providers/target-store';
import { APP_DEPLOYMENTS_ENABLED } from './app-deployments-enabled-token';
import {
  PersistedDocumentIngester,
  type PreprocessedDocument,
} from './persisted-document-ingester';
import { PersistedDocumentScheduler } from './persisted-document-scheduler';

export const AppDeploymentNameModel = z
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
    private pool: PostgresDatabasePool,
    private s3: S3Writer,
    private clickhouse: ClickHouse,
    private storage: Storage,
    private targetStore: TargetStore,
    private schemaVersionHelper: SchemaVersionHelper,
    private persistedDocumentScheduler: PersistedDocumentScheduler,
    private persistedDocumentIngester: PersistedDocumentIngester,
    private schemaVersions: SchemaVersionStore,
    @Inject(APP_DEPLOYMENTS_ENABLED) private appDeploymentsEnabled: boolean,
  ) {
    this.logger = logger.child({ source: 'AppDeployments' });
  }

  async getAppDeploymentById(args: {
    appDeploymentId: string;
  }): Promise<AppDeploymentRecord | null> {
    this.logger.debug('get app deployment by id (appDeploymentId=%s)', args.appDeploymentId);

    const record = await this.pool.maybeOne(
      psql`
        SELECT
          ${appDeploymentFields}
        FROM
          "app_deployments"
        WHERE
          "id" = ${args.appDeploymentId}
      `,
    );

    if (!record) {
      return null;
    }

    return AppDeploymentModel.parse(record);
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

    const record = await this.pool.maybeOne(
      psql`
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
        organizationId: args.organizationId,
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
        psql`
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

  async addDocumentsToAppDeployment(
    args: {
      graph: Graph;
      appDeployment: {
        name: string;
        version: string;
      };
      operations: ReadonlyArray<{
        hash: string;
        body: string;
      }>;
    },
    signal: AbortSignal,
  ) {
    if (this.appDeploymentsEnabled === false) {
      const organization = await this.storage.getOrganization({
        organizationId: args.graph.organizationId,
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
      targetId: args.graph.targetId,
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
      const latestSchemaVersion =
        await this.schemaVersions.getMaybeLatestValidSchemaVersionForGraph(args.graph);

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
        organizationId: args.graph.organizationId,
        projectId: args.graph.projectId,
        targetId: args.graph.targetId,
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

      const result = await this.persistedDocumentScheduler.processBatch(
        {
          schemaSdl: compositeSchemaSdl,
          targetId: args.graph.targetId,
          appDeployment: {
            id: appDeployment.id,
            name: args.appDeployment.name,
            version: args.appDeployment.version,
          },
          documents: args.operations,
        },
        signal,
      );

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

  async addPreprocessedDocumentsToAppDeployment(
    args: {
      graph: Graph;
      appDeployment: {
        name: string;
        version: string;
      };
      documents: ReadonlyArray<PreprocessedDocument>;
    },
    signal: AbortSignal,
  ) {
    if (this.appDeploymentsEnabled === false) {
      const organization = await this.storage.getOrganization({
        organizationId: args.graph.organizationId,
      });
      if (organization.featureFlags.appDeployments === false) {
        return {
          type: 'error' as const,
          error: { message: noAccessToAppDeploymentsMessage, details: null },
        };
      }
    }

    const appDeployment = await this.findAppDeployment({
      targetId: args.graph.targetId,
      name: args.appDeployment.name,
      version: args.appDeployment.version,
    });

    if (appDeployment === null) {
      return {
        type: 'error' as const,
        error: { message: 'App deployment not found', details: null },
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

    const result = await this.persistedDocumentIngester.processPreprocessedBatch(
      {
        targetId: args.graph.targetId,
        appDeployment: {
          id: appDeployment.id,
          name: args.appDeployment.name,
          version: args.appDeployment.version,
        },
        documents: args.documents,
      },
      signal,
    );

    if (result.type === 'error') {
      return result;
    }

    return { type: 'success' as const, appDeployment };
  }

  private async _getAllDocumentHashesForAppDeployment(
    appDeployment: AppDeploymentRecord,
  ): Promise<Array<string>> {
    return await this.clickhouse
      .query({
        query: cSql`
          SELECT
            DISTINCT "document_hash" AS "hash"
          FROM
            "app_deployment_documents"
          WHERE
            "app_deployment_id" = ${appDeployment.id}
        `,
        queryId: 'app-deployment-document-ids',
        timeout: 10_000,
      })
      .then(res =>
        z.array(z.object({ hash: z.string() }).transform(row => row.hash)).parse(res.data),
      );
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
        organizationId: args.organizationId,
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

    const appDeploymentDocumentHashes =
      await this._getAllDocumentHashesForAppDeployment(appDeployment);

    let results = await this.s3.write(
      buildAppDeploymentIsEnabledKey(
        appDeployment.targetId,
        appDeployment.name,
        appDeployment.version,
      ),
      'app_deployment_enabled',
      {
        body: '1',
        headers: {
          'content-type': 'text/plain',
        },
      },
    );

    for (const result of results) {
      if (result.statusCode !== 200) {
        throw new Error(`Failed to enable app deployment: ${result.statusMessage}`);
      }
    }

    results = await this.s3.write(
      buildAppDeploymentManifestKey(
        appDeployment.targetId,
        appDeployment.name,
        appDeployment.version,
      ),
      'app_deployment_manifest',
      {
        body: JSON.stringify({
          id: appDeployment.id,
          appName: appDeployment.name,
          appVersion: appDeployment.version,
          documentHashes: appDeploymentDocumentHashes.sort(),
          isActive: true,
        } satisfies z.TypeOf<typeof AppDeploymentManifestModel>),
        headers: {
          'content-type': 'application/json',
        },
      },
    );

    for (const result of results) {
      if (result.statusCode !== 200) {
        throw new Error(`Failed to write app manifest: ${result.statusMessage}`);
      }
    }

    const updatedAppDeployment = await this.pool
      .maybeOne(
        psql`
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
    projectId: string;
    targetId: string;
    appDeployment: {
      name: string;
      version: string;
    };
    force?: boolean;
  }): Promise<
    | { type: 'success'; appDeployment: AppDeploymentRecord }
    | {
        type: 'error';
        message: string;
        protectionDetails?: {
          lastUsed: Date | null;
          daysSinceLastUsed: number | null;
          requiredMinDaysInactive: number;
          currentTrafficPercentage: number | null;
          maxTrafficPercentage: number;
        };
      }
  > {
    this.logger.debug('retire app deployment (targetId=%s, appName=%s, appVersion=%s)');

    if (this.appDeploymentsEnabled === false) {
      const organization = await this.storage.getOrganization({
        organizationId: args.organizationId,
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
        'retire app deployment failed as it does not exist. (targetId=%s, appName=%s, appVersion=%s)',
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
        'retire app deployment failed as it was never active. (targetId=%s, appDeploymentId=%s)',
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
        'retire app deployment failed as it is already retired. (targetId=%s, appDeploymentId=%s)',
        args.targetId,
        appDeployment.id,
      );

      return {
        type: 'error' as const,
        message: 'App deployment is already retired',
      };
    }

    // Check protection settings if force flag is not set
    if (args.force !== true) {
      const targetSettings = await this.targetStore.getTargetSettings({
        organizationId: args.organizationId,
        targetId: args.targetId,
        projectId: args.projectId,
      });

      if (targetSettings.appDeploymentProtection.isEnabled) {
        const protectionConfig = targetSettings.appDeploymentProtection;

        // Get last used timestamp
        const lastUsedResults = await this.getLastUsedForAppDeployments({
          appDeploymentIds: [appDeployment.id],
        });
        const lastUsedStr =
          lastUsedResults.find(r => r.appDeploymentId === appDeployment.id)?.lastUsed ?? null;
        const lastUsed = lastUsedStr ? new Date(lastUsedStr) : null;

        // Calculate days since last used
        let daysSinceLastUsed: number | null = null;
        if (lastUsed) {
          const now = new Date();
          const diffMs = now.getTime() - lastUsed.getTime();
          daysSinceLastUsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        // Get traffic percentage using configured period
        const trafficData = await this.getAppDeploymentTrafficPercentage({
          targetId: args.targetId,
          appName: args.appDeployment.name,
          appVersion: args.appDeployment.version,
          periodDays: protectionConfig.trafficPeriodDays,
        });
        const trafficPercentage = trafficData?.trafficPercentage ?? null;

        // Check protection rules:
        // 1. App deployment must have been created at least minDaysSinceCreation days ago
        // 2. If usage data exists, check inactivity and traffic criteria based on ruleLogic:
        //    AND: Both conditions must pass (inactive enough AND low traffic)
        //    OR: Either condition can pass (inactive enough OR low traffic)

        let isBlocked = false;
        let blockReason = '';

        const createdAt = new Date(appDeployment.createdAt);
        const daysSinceCreation = differenceInCalendarDays(new Date(), createdAt);

        if (daysSinceCreation < protectionConfig.minDaysSinceCreation) {
          isBlocked = true;
          blockReason = `App deployment was created ${daysSinceCreation} days ago, but requires at least ${protectionConfig.minDaysSinceCreation} days since creation`;
        } else if (lastUsed !== null) {
          const inactiveEnough =
            daysSinceLastUsed === null || daysSinceLastUsed >= protectionConfig.minDaysInactive;
          const lowTraffic =
            trafficPercentage === null ||
            trafficPercentage <= protectionConfig.maxTrafficPercentage;

          if (protectionConfig.ruleLogic === 'OR') {
            // OR logic: retirement allowed if EITHER condition is met
            isBlocked = !inactiveEnough && !lowTraffic;
            if (isBlocked) {
              blockReason = `App deployment was used ${daysSinceLastUsed} days ago (requires ${protectionConfig.minDaysInactive}) and has ${trafficPercentage?.toFixed(2)}% traffic (max ${protectionConfig.maxTrafficPercentage}%)`;
            }
          } else {
            // AND logic (default): retirement allowed only if BOTH conditions are met
            if (!inactiveEnough) {
              isBlocked = true;
              blockReason = `App deployment was used ${daysSinceLastUsed} days ago, but requires ${protectionConfig.minDaysInactive} days of inactivity`;
            } else if (!lowTraffic) {
              isBlocked = true;
              blockReason = `App deployment has ${trafficPercentage?.toFixed(2)}% of traffic, but maximum allowed is ${protectionConfig.maxTrafficPercentage}%`;
            }
          }
        }

        if (isBlocked) {
          this.logger.debug(
            'retire app deployment blocked by protection settings. (targetId=%s, appDeploymentId=%s, reason=%s)',
            args.targetId,
            appDeployment.id,
            blockReason,
          );

          return {
            type: 'error' as const,
            message: `App deployment retirement blocked by protection settings. ${blockReason}.`,
            protectionDetails: {
              lastUsed,
              daysSinceLastUsed,
              requiredMinDaysInactive: protectionConfig.minDaysInactive,
              currentTrafficPercentage: trafficPercentage,
              maxTrafficPercentage: protectionConfig.maxTrafficPercentage,
            },
          };
        }
      }
    }

    const appDeploymentDocumentHashes =
      await this._getAllDocumentHashesForAppDeployment(appDeployment);

    let results = await this.s3.request(
      buildAppDeploymentIsEnabledKey(
        appDeployment.targetId,
        appDeployment.name,
        appDeployment.version,
      ),
      {
        method: 'DELETE',
      },
    );

    /** We receive a 204 status code if the DELETE operation was successful */
    for (const result of results) {
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

    results = await this.s3.write(
      buildAppDeploymentManifestKey(
        appDeployment.targetId,
        appDeployment.name,
        appDeployment.version,
      ),
      'app_deployment_manifest',
      {
        body: JSON.stringify({
          id: appDeployment.id,
          appName: appDeployment.name,
          appVersion: appDeployment.version,
          documentHashes: appDeploymentDocumentHashes.sort(),
          isActive: false,
        } satisfies z.TypeOf<typeof AppDeploymentManifestModel>),
        headers: {
          'content-type': 'application/json',
        },
      },
    );

    for (const result of results) {
      if (result.statusCode !== 200) {
        throw new Error(`Failed to write app manifest: ${result.statusMessage}`);
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
      queryId: 'app-deployment-retire',
    });

    const updatedAppDeployment = await this.pool
      .one(
        psql`
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

  async countAppDeployments(targetId: string): Promise<number> {
    return this.pool
      .oneFirst(
        psql`
      SELECT count(*) FROM "app_deployments" WHERE "target_id" = ${targetId}
    `,
      )
      .then(z.number().parse);
  }

  async getPaginatedAppDeployments(args: {
    targetId: string;
    cursor: string | null;
    first: number | null;
    sort: { field: 'CREATED_AT' | 'ACTIVATED_AT'; direction: 'ASC' | 'DESC' } | null;
  }) {
    this.logger.debug(
      'get paginated app deployments (targetId=%s, cursor=%s, sort=%o)',
      args.targetId,
      args.cursor,
      args.sort,
    );
    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const sortField = args.sort?.field ?? 'CREATED_AT';
    const sortDirection = args.sort?.direction ?? 'DESC';

    let cursor = null;
    if (args.cursor) {
      try {
        cursor = decodeAppDeploymentSortCursor(args.cursor);
      } catch (error) {
        this.logger.debug(
          'Failed to decode cursor for getPaginatedAppDeployments (targetId=%s, cursor=%s): %s',
          args.targetId,
          args.cursor,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    if (cursor && cursor.sortField !== sortField) {
      this.logger.debug(
        'Cursor sort field mismatch (targetId=%s, cursorField=%s, requestedField=%s). Ignoring cursor.',
        args.targetId,
        cursor.sortField,
        sortField,
      );
      cursor = null;
    }

    const col = psql.identifier([sortField === 'ACTIVATED_AT' ? 'activated_at' : 'created_at']);
    const isNullable = sortField === 'ACTIVATED_AT';
    const isDesc = sortDirection === 'DESC';

    let cursorCondition = psql``;
    if (cursor) {
      const cv = cursor.sortValue;
      const tiebreakOp = isDesc ? psql`<` : psql`>`;

      if (cv === null) {
        cursorCondition = psql`AND (${col} IS NULL AND "id" ${tiebreakOp} ${cursor.id})`;
      } else if (isNullable) {
        cursorCondition = isDesc
          ? psql`AND ((${col} = ${cv} AND "id" < ${cursor.id}) OR ${col} < ${cv} OR ${col} IS NULL)`
          : psql`AND ((${col} = ${cv} AND "id" > ${cursor.id}) OR ${col} > ${cv} OR ${col} IS NULL)`;
      } else {
        cursorCondition = isDesc
          ? psql`AND ((${col} = ${cv} AND "id" < ${cursor.id}) OR ${col} < ${cv})`
          : psql`AND ((${col} = ${cv} AND "id" > ${cursor.id}) OR ${col} > ${cv})`;
      }
    }

    const dirSql = isDesc ? psql`DESC` : psql`ASC`;
    const nullsLast = isNullable ? psql`NULLS LAST` : psql``;
    const orderBy = psql`ORDER BY ${col} ${dirSql} ${nullsLast}, "id" ${dirSql}`;

    const result = await this.pool.any(psql`
      SELECT
        ${appDeploymentFields}
      FROM
        "app_deployments"
      WHERE
        "target_id" = ${args.targetId}
        ${cursorCondition}
      ${orderBy}
      LIMIT ${limit + 1}
    `);

    let items = result.map(row => {
      const node = AppDeploymentModel.parse(row);
      const sortValue = sortField === 'ACTIVATED_AT' ? node.activatedAt : node.createdAt;

      return {
        cursor: encodeAppDeploymentSortCursor({
          sortField,
          sortValue,
          id: node.id,
        }),
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

  async getPaginatedAppDeploymentsSortedByLastUsed(args: {
    targetId: string;
    cursor: string | null;
    first: number | null;
    direction: 'ASC' | 'DESC';
  }) {
    this.logger.debug(
      'get paginated app deployments sorted by last used (targetId=%s, cursor=%s, direction=%s)',
      args.targetId,
      args.cursor,
      args.direction,
    );
    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const isDesc = args.direction === 'DESC';
    let cursor = null;
    if (args.cursor) {
      try {
        cursor = decodeAppDeploymentSortCursor(args.cursor);
      } catch (error) {
        this.logger.debug(
          'Failed to decode cursor for getPaginatedAppDeploymentsSortedByLastUsed (targetId=%s, cursor=%s): %s',
          args.targetId,
          args.cursor,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    if (cursor && cursor.sortField !== 'LAST_USED') {
      this.logger.debug(
        'Cursor sort field mismatch (targetId=%s, cursorField=%s, requestedField=LAST_USED). Ignoring cursor.',
        args.targetId,
        cursor.sortField,
      );
      cursor = null;
    }

    const cursorInNoUsageSection = cursor !== null && cursor.sortValue === null;
    let usageForPage: Array<{ appName: string; appVersion: string; lastUsed: string }> = [];

    if (!cursorInNoUsageSection) {
      const chDirSql = isDesc ? cSql`DESC` : cSql`ASC`;
      let chCursorCondition = cSql``;
      if (cursor && cursor.sortValue !== null) {
        chCursorCondition = isDesc
          ? cSql`HAVING lastUsed <= ${cursor.sortValue}`
          : cSql`HAVING lastUsed >= ${cursor.sortValue}`;
      }

      let chResult;
      try {
        chResult = await this.clickhouse.query({
          query: cSql`
            SELECT
              app_name AS appName,
              app_version AS appVersion,
              formatDateTimeInJodaSyntax(max(last_request), 'yyyy-MM-dd\\'T\\'HH:mm:ss.000000+00:00') AS lastUsed
            FROM app_deployment_usage
            WHERE target_id = ${args.targetId}
            GROUP BY app_name, app_version
            ${chCursorCondition}
            ORDER BY lastUsed ${chDirSql}
            LIMIT ${cSql.raw(String(limit + 1))}
          `,
          queryId: 'get-all-deployments-last-used-for-sorting',
          timeout: 30_000,
        });
      } catch (error) {
        this.logger.error(
          'Failed to query deployment last-used from ClickHouse (targetId=%s): %s',
          args.targetId,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }

      const chModel = z.array(
        z.object({
          appName: z.string(),
          appVersion: z.string(),
          lastUsed: z.string(),
        }),
      );
      usageForPage = chModel.parse(chResult.data);
    }

    const usagePairsForPage = usageForPage.map(r => `${r.appName}:${r.appVersion}`);
    const deploymentByPair = new Map();

    if (usagePairsForPage.length > 0) {
      const pgResult = await this.pool.any(psql`
        SELECT ${appDeploymentFields}
        FROM "app_deployments"
        WHERE "target_id" = ${args.targetId}
          AND ("name" || ':' || "version") = ANY(${psql.array(usagePairsForPage, 'text')})
      `);
      for (const row of pgResult) {
        const d = AppDeploymentModel.parse(row);
        deploymentByPair.set(`${d.name}:${d.version}`, d);
      }
    }

    let pageItems: Array<{ node: AppDeploymentRecord; lastUsed: string | null }> = [];
    for (const usage of usageForPage) {
      const node = deploymentByPair.get(`${usage.appName}:${usage.appVersion}`);
      if (node) {
        pageItems.push({ node, lastUsed: usage.lastUsed });
      }
    }

    if (cursor && cursor.sortValue !== null) {
      const cursorIdx = pageItems.findIndex(item => item.node.id === cursor.id);
      if (cursorIdx !== -1) {
        pageItems = pageItems.slice(cursorIdx + 1);
      } else {
        pageItems = pageItems.filter(item => {
          const cmp = item.lastUsed!.localeCompare(cursor.sortValue!);
          if (cmp === 0) return item.node.id !== cursor.id;
          return isDesc ? cmp < 0 : cmp > 0;
        });
      }
    }

    const remaining = limit + 1 - pageItems.length;
    let fillHasMore = false;
    if (remaining > 0) {
      const dirSql = isDesc ? psql`DESC` : psql`ASC`;
      let fillCursorCondition = psql``;
      if (cursorInNoUsageSection) {
        fillCursorCondition = isDesc
          ? psql`AND "id" < ${cursor!.id}`
          : psql`AND "id" > ${cursor!.id}`;
      }

      const excludeCurrentPage =
        usagePairsForPage.length > 0
          ? psql`AND NOT (("name" || ':' || "version") = ANY(${psql.array(usagePairsForPage, 'text')}))`
          : psql``;

      const fillResult = await this.pool.any(psql`
        SELECT ${appDeploymentFields}
        FROM "app_deployments"
        WHERE "target_id" = ${args.targetId}
          ${excludeCurrentPage}
          ${fillCursorCondition}
        ORDER BY "id" ${dirSql}
        LIMIT ${limit + 1}
      `);

      const candidates = fillResult.map(row => AppDeploymentModel.parse(row));
      fillHasMore = candidates.length > limit;

      if (candidates.length > 0) {
        const candidateTuples = candidates.map(
          c => cSql`(${args.targetId}, ${c.name}, ${c.version})`,
        );
        let usageCheckResult;
        try {
          usageCheckResult = await this.clickhouse.query({
            query: cSql`
              SELECT DISTINCT app_name, app_version
              FROM app_deployment_usage
              WHERE (target_id, app_name, app_version)
                IN (${candidateTuples.reduce((a, b) => cSql`${a}, ${b}`)})
            `,
            queryId: 'check-candidates-have-usage',
            timeout: 10_000,
          });
        } catch (error) {
          this.logger.error(
            'Failed to check candidate usage from ClickHouse (targetId=%s): %s',
            args.targetId,
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
        const pairsWithUsage = new Set(
          z
            .array(z.object({ app_name: z.string(), app_version: z.string() }))
            .parse(usageCheckResult.data)
            .map(r => `${r.app_name}:${r.app_version}`),
        );

        for (const candidate of candidates) {
          if (pageItems.length >= limit + 1) break;
          if (!pairsWithUsage.has(`${candidate.name}:${candidate.version}`)) {
            pageItems.push({ node: candidate, lastUsed: null });
          }
        }
      }
    }

    const hasNextPage = pageItems.length > limit || fillHasMore;
    const finalItems = pageItems.slice(0, limit);

    const items = finalItems.map(item => ({
      cursor: encodeAppDeploymentSortCursor({
        sortField: 'LAST_USED',
        sortValue: item.lastUsed,
        id: item.node.id,
      }),
      node: item.node,
    }));

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
    operationName: string;
    schemaCoordinates: string[] | null;
  }) {
    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const cursor = args.cursor ? decodeHashBasedCursor(args.cursor) : null;
    const operationName = args.operationName.trim();
    const schemaCoordinates = args.schemaCoordinates;
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
          ${operationName.length ? cSql`AND "operation_name" ILIKE CONCAT('%', ${operationName}, '%')` : cSql``}
          ${schemaCoordinates?.length ? cSql`AND hasAny("schema_coordinates", ${cSql.array(schemaCoordinates, 'String')})` : cSql``}
        ORDER BY "app_deployment_id", ${operationName.length ? cSql`positionCaseInsensitive("operation_name", ${operationName}) ASC, "operation_name" ASC` : cSql`"document_hash"`}
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
          , formatDateTimeInJodaSyntax(max("app_deployment_usage"."last_request"), 'yyyy-MM-dd\\'T\\'HH:mm:ss.000000+00:00') AS "lastUsed"
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

  private async getStaleDeploymentIds(args: {
    targetId: string;
    name: string | null;
    lastUsedBefore: string | null;
    neverUsedAndCreatedBefore: string | null;
  }): Promise<string[]> {
    const { targetId, name, lastUsedBefore, neverUsedAndCreatedBefore } = args;

    if (!lastUsedBefore && !neverUsedAndCreatedBefore) {
      return [];
    }

    const lastUsedCondition = lastUsedBefore
      ? cSql`(target_id, app_name, app_version) IN (
          SELECT target_id, app_name, app_version
          FROM app_deployment_usage
          WHERE target_id = ${targetId}
          GROUP BY target_id, app_name, app_version
          HAVING max(last_request) < parseDateTimeBestEffort(${lastUsedBefore})
        )`
      : null;

    const neverUsedCondition = neverUsedAndCreatedBefore
      ? cSql`(target_id, app_name, app_version) NOT IN (
          SELECT DISTINCT target_id, app_name, app_version
          FROM app_deployment_usage
          WHERE target_id = ${targetId}
        )`
      : null;

    const staleCondition = (
      lastUsedCondition && neverUsedCondition
        ? cSql`(${lastUsedCondition} OR ${neverUsedCondition})`
        : (lastUsedCondition ?? neverUsedCondition)
    )!;

    let result;
    try {
      result = await this.clickhouse.query({
        query: cSql`
          SELECT app_deployment_id FROM app_deployments
          WHERE target_id = ${targetId}
            ${name ? cSql`AND app_name ILIKE ${'%' + name + '%'}` : cSql``}
            AND ${staleCondition}
        `,
        queryId: 'get-stale-deployment-ids',
        timeout: 30_000,
      });
    } catch (error) {
      this.logger.error(
        'Failed to query stale deployment IDs from clickhouse (targetId=%s, lastUsedBefore=%s, neverUsedAndCreatedBefore=%s): %s',
        targetId,
        lastUsedBefore,
        neverUsedAndCreatedBefore,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    const model = z.array(z.object({ app_deployment_id: z.string() }));
    const parsed = model.parse(result.data);

    this.logger.debug(
      'found %d stale deployment candidates from clickhouse (targetId=%s)',
      parsed.length,
      targetId,
    );

    return parsed.map(row => row.app_deployment_id);
  }

  private async getActiveDeployments(args: {
    targetId: string;
    schemaCoordinates: string[];
    excludedAppDeploymentNames?: string[] | null;
  }) {
    // Get active deployments
    let activeDeploymentsResult;
    try {
      activeDeploymentsResult = await this.clickhouse.query({
        query: cSql`
          SELECT
            app_deployment_id AS "appDeploymentId",
            any(app_name) AS "appName",
            any(app_version) AS "appVersion"
          FROM app_deployments
          PREWHERE
            target_id = ${args.targetId}
            ${
              args.excludedAppDeploymentNames?.length
                ? cSql`AND app_name NOT IN (${cSql.array(args.excludedAppDeploymentNames, 'String')})`
                : cSql``
            }
          GROUP BY app_deployment_id
          HAVING min(is_active) = True
        `,
        queryId: 'get-active-app-deployment-ids',
        timeout: 30_000,
      });
    } catch (error) {
      this.logger.error(
        'Failed to query active app deployments from ClickHouse (targetId=%s): %s',
        args.targetId,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    const ActiveDeploymentModel = z.object({
      appDeploymentId: z.string(),
      appName: z.string(),
      appVersion: z.string(),
    });

    return z.array(ActiveDeploymentModel).parse(activeDeploymentsResult.data);
  }

  private async getAffectedAppDeploymentsMetadata(appDeploymentIds: Array<string>) {
    return await this.pool
      .any(
        psql`
          SELECT
            "id"
            , "name"
            , "version"
            , to_json("created_at") AS "createdAt"
            , to_json("activated_at") AS "activatedAt"
            , to_json("retired_at") AS "retiredAt"
          FROM
            "app_deployments"
          WHERE "id" = ANY(${psql.array(appDeploymentIds, 'uuid')})
        `,
      )
      .then(
        z
          .array(
            z.object({
              id: z.string().uuid(),
              name: z.string(),
              version: z.string(),
              createdAt: z.string(),
              activatedAt: z.string().nullable(),
              retiredAt: z.string().nullable(),
            }),
          )
          .transform(values => {
            const map = new Map<string, (typeof values)[0]>();
            for (const value of values) {
              map.set(value.id, value);
            }
            return map;
          }).parse,
      );
  }

  private async getAffectedAppDeploymentsDocumentsSample(args: {
    targetId: string;
    schemaCoordinates: Array<string>;
    appDeploymentIds: Array<string>;
  }) {
    const affectedAppDeploymentsQuery = cSql`
      SELECT
        "coordinate" AS "coordinate"
        , "app_deployment_id" AS "appDeploymentId"
        , "document_hash" AS "hash"
        , "operation_name" AS "name"
      FROM
        "app_deployment_document_coordinates"
      PREWHERE
        "target_id" = ${args.targetId}
        AND "coordinate" IN (${cSql.longArray(args.schemaCoordinates, 'String')})
        AND "app_deployment_id" IN (${cSql.longArray(args.appDeploymentIds, 'String')})
      LIMIT 5 BY "coordinate", "app_deployment_id"
    `;

    const affectedAppDeploymentsResult = await this.clickhouse.query({
      query: affectedAppDeploymentsQuery,
      queryId: 'find_affected_app_deployments_operations_query',
      timeout: 30_000,
    });

    return z
      .array(
        z.object({
          coordinate: z.string(),
          appDeploymentId: z.string(),
          hash: z.string(),
          name: z.string().transform(value => (value === '' ? null : value)),
        }),
      )
      .transform(records => {
        const map = new Map<string, Array<Pick<(typeof records)[number], 'hash' | 'name'>>>();

        records.forEach(record => {
          const key = `${record.coordinate}|${record.appDeploymentId}`;
          let records = map.get(key);
          if (!records) {
            records = [];
            map.set(key, records);
          }

          records.push({
            hash: record.hash,
            name: record.name,
          });
        });

        return map;
      })
      .parse(affectedAppDeploymentsResult.data);
  }

  async getAffectedAppDeploymentsBySchemaCoordinates(args: {
    targetId: string;
    schemaCoordinates: Array<string>;
    excludedAppDeploymentNames: Array<string> | null;
  }) {
    const affectedAppDeploymentsQuery = cSql`
      SELECT
        "coordinate"
        , "app_deployment_id" AS "appDeploymentId"
        , COUNT(DISTINCT "document_hash") AS "affectedDocumentCount"
      FROM
        "app_deployment_document_coordinates"
      PREWHERE
        "target_id" = ${args.targetId}
        AND "coordinate" IN (${cSql.longArray(args.schemaCoordinates, 'String')})
        AND "app_deployment_id" IN (
          SELECT
            "app_deployment_id"
          FROM
            "app_deployments"
          PREWHERE
            target_id = ${args.targetId}
            ${
              args.excludedAppDeploymentNames?.length
                ? cSql`AND "app_name" NOT IN (${cSql.array(args.excludedAppDeploymentNames, 'String')})`
                : cSql``
            }
            GROUP BY
              "app_deployment_id"
            HAVING
              min("is_active") = True
          )
      GROUP BY
        "coordinate"
        , "app_deployment_id"
    `;

    const affectedAppDeploymentsResult = await this.clickhouse.query({
      query: affectedAppDeploymentsQuery,
      queryId: 'find_affected_app_deployments_query',
      timeout: 30_000,
    });

    const affectedAppDeploymentsBySchemaCoordinate: AffectAppDeploymentsBySchemaCoordinate =
      new Map();

    if (affectedAppDeploymentsResult.rows === 0) {
      return affectedAppDeploymentsBySchemaCoordinate;
    }

    const data = z
      .array(
        z.object({
          coordinate: z.string(),
          appDeploymentId: z.string().uuid(),
          affectedDocumentCount: z.coerce.number(),
        }),
      )
      .parse(affectedAppDeploymentsResult.data);

    const uniqueAppDeploymentIds = Array.from(new Set(data.map(record => record.appDeploymentId)));

    const [metadata, affectedDocumentsSample] = await Promise.all([
      this.getAffectedAppDeploymentsMetadata(uniqueAppDeploymentIds),
      this.getAffectedAppDeploymentsDocumentsSample({
        targetId: args.targetId,
        schemaCoordinates: args.schemaCoordinates,
        appDeploymentIds: uniqueAppDeploymentIds,
      }),
    ]);

    data.forEach(row => {
      const meta = metadata.get(row.appDeploymentId);
      if (!meta) {
        this.logger.debug(
          'could not resolve pg app deployment for clickhouse record (appDeploymentId=%s)',
          row.appDeploymentId,
        );
        return;
      }
      if (meta.activatedAt === null) {
        this.logger.debug(
          'the pg record is not activated (appDeploymentId=%s)',
          row.appDeploymentId,
        );
        return;
      }
      if (meta.retiredAt !== null) {
        this.logger.debug('the pg record is retired (appDeploymentId=%s)', row.appDeploymentId);
        return;
      }

      let affectedAppDeployments = affectedAppDeploymentsBySchemaCoordinate.get(row.coordinate);
      if (!affectedAppDeployments) {
        affectedAppDeployments = [];
        affectedAppDeploymentsBySchemaCoordinate.set(row.coordinate, affectedAppDeployments);
      }

      affectedAppDeployments.push({
        ...meta,
        activatedAt: meta.activatedAt,
        affectedOperations:
          affectedDocumentsSample.get(`${row.coordinate}|${row.appDeploymentId}`) ?? [],
      });
    });

    return affectedAppDeploymentsBySchemaCoordinate;
  }

  async getActiveAppDeployments(args: {
    targetId: string;
    cursor: string | null;
    first: number | null;
    filter: {
      name?: string | null;
      lastUsedBefore?: string | null;
      neverUsedAndCreatedBefore?: string | null;
    };
  }) {
    this.logger.debug(
      'get active app deployments (targetId=%s, cursor=%s, first=%s, filter=%o)',
      args.targetId,
      args.cursor ? '[provided]' : '[none]',
      args.first,
      args.filter,
    );

    if (args.filter.lastUsedBefore && Number.isNaN(Date.parse(args.filter.lastUsedBefore))) {
      this.logger.debug(
        'invalid lastUsedBefore filter (targetId=%s, value=%s)',
        args.targetId,
        args.filter.lastUsedBefore,
      );
      throw new Error(
        `Invalid lastUsedBefore filter: "${args.filter.lastUsedBefore}" is not a valid date string`,
      );
    }
    if (
      args.filter.neverUsedAndCreatedBefore &&
      Number.isNaN(Date.parse(args.filter.neverUsedAndCreatedBefore))
    ) {
      this.logger.debug(
        'invalid neverUsedAndCreatedBefore filter (targetId=%s, value=%s)',
        args.targetId,
        args.filter.neverUsedAndCreatedBefore,
      );
      throw new Error(
        `Invalid neverUsedAndCreatedBefore filter: "${args.filter.neverUsedAndCreatedBefore}" is not a valid date string`,
      );
    }

    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;

    let cursor = null;
    if (args.cursor) {
      try {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      } catch (error) {
        this.logger.error(
          'Failed to decode cursor for activeAppDeployments (targetId=%s, cursor=%s): %s',
          args.targetId,
          args.cursor,
          error instanceof Error ? error.message : String(error),
        );
        throw new Error(
          `Invalid cursor format for activeAppDeployments. Expected a valid pagination cursor.`,
        );
      }
    }

    // Get active deployments from db
    const hasDateFilter = args.filter.lastUsedBefore || args.filter.neverUsedAndCreatedBefore;
    const maxDeployments = 1000; // note: hard limit, only applies when no date filters are used

    // When date filters are present, query clickhouse first to identify stale deployment IDs
    // This avoids the LIMIT 1000 problem where old stale deployments get cut off
    let staleDeploymentIds: string[] | undefined;
    if (hasDateFilter) {
      staleDeploymentIds = await this.getStaleDeploymentIds({
        targetId: args.targetId,
        name: args.filter.name ?? null,
        lastUsedBefore: args.filter.lastUsedBefore ?? null,
        neverUsedAndCreatedBefore: args.filter.neverUsedAndCreatedBefore ?? null,
      });

      this.logger.debug(
        'found %d stale deployment candidates from clickhouse (targetId=%s)',
        staleDeploymentIds.length,
        args.targetId,
      );

      if (staleDeploymentIds.length === 0) {
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: cursor !== null,
            endCursor: '',
            startCursor: '',
          },
        };
      }
    }

    // Fetch deployments from postgres
    // When using stale deployment IDs, batch queries to avoid issues with large arrays
    const BATCH_SIZE = 1000;
    let activeDeployments;

    try {
      if (staleDeploymentIds) {
        // Batch the IDs to avoid query size issues
        const batches: string[][] = [];
        for (let i = 0; i < staleDeploymentIds.length; i += BATCH_SIZE) {
          batches.push(staleDeploymentIds.slice(i, i + BATCH_SIZE));
        }

        const batchResults = await Promise.all(
          batches.map(batchIds =>
            this.pool.any(psql`
              SELECT
                ${appDeploymentFields}
              FROM
                "app_deployments"
              WHERE
                "id" = ANY(${psql.array(batchIds, 'uuid')})
                AND "activated_at" IS NOT NULL
                AND "retired_at" IS NULL
            `),
          ),
        );

        // Merge and sort results
        activeDeployments = batchResults
          .flatMap(result => result.map(row => AppDeploymentModel.parse(row)))
          .sort((a, b) => {
            // Sort by created_at DESC, id ASC
            if (a.createdAt > b.createdAt) return -1;
            if (a.createdAt < b.createdAt) return 1;
            return a.id.localeCompare(b.id);
          });
      } else {
        const activeDeploymentsResult = await this.pool.any(psql`
          SELECT
            ${appDeploymentFields}
          FROM
            "app_deployments"
          WHERE
            "target_id" = ${args.targetId}
            ${args.filter.name ? psql`AND "name" ILIKE ${'%' + args.filter.name + '%'}` : psql``}
            AND "activated_at" IS NOT NULL
            AND "retired_at" IS NULL
          ORDER BY "created_at" DESC, "id" ASC
          LIMIT ${maxDeployments}
        `);

        activeDeployments = activeDeploymentsResult.map(row => AppDeploymentModel.parse(row));
      }
    } catch (error) {
      const batchCount = staleDeploymentIds ? Math.ceil(staleDeploymentIds.length / BATCH_SIZE) : 0;
      this.logger.error(
        'Failed to query active deployments from PostgreSQL (targetId=%s, batchCount=%d, totalIds=%d): %s',
        args.targetId,
        batchCount,
        staleDeploymentIds?.length ?? 0,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    this.logger.debug(
      'found %d active deployments for target (targetId=%s)',
      activeDeployments.length,
      args.targetId,
    );

    if (activeDeployments.length === 0) {
      return {
        edges: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: cursor !== null,
          endCursor: '',
          startCursor: '',
        },
      };
    }

    // Get lastUsed data from clickhouse for all active deployment IDs
    // Batch to avoid clickhouse Cloud's HTTP form field size limit
    const deploymentIds = activeDeployments.map(d => d.id);
    let usageData;
    try {
      const batches = [];
      for (let i = 0; i < deploymentIds.length; i += BATCH_SIZE) {
        batches.push(deploymentIds.slice(i, i + BATCH_SIZE));
      }
      const batchResults = await Promise.all(
        batches.map(batchIds => this.getLastUsedForAppDeployments({ appDeploymentIds: batchIds })),
      );
      usageData = batchResults.flat();
    } catch (error) {
      this.logger.error(
        'Failed to query lastUsed data from ClickHouse (targetId=%s, deploymentCount=%d): %s',
        args.targetId,
        deploymentIds.length,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    // Create a map of deployment ID -> lastUsed date
    const lastUsedMap = new Map<string, string>();
    for (const usage of usageData) {
      lastUsedMap.set(usage.appDeploymentId, usage.lastUsed);
    }

    // Apply OR filter logic for date filters
    // If no date filters provided, return all active deployments (name filter already applied in SQL)
    const filteredDeployments = activeDeployments.filter(deployment => {
      // If no date filters, include all deployments
      if (!hasDateFilter) {
        return true;
      }

      const lastUsed = lastUsedMap.get(deployment.id);
      const hasBeenUsed = lastUsed !== undefined;

      // Check lastUsedBefore filter, deployment HAS been used AND was last used before the threshold
      if (args.filter.lastUsedBefore && hasBeenUsed) {
        const lastUsedDate = new Date(lastUsed);
        const thresholdDate = new Date(args.filter.lastUsedBefore);
        if (Number.isNaN(thresholdDate.getTime())) {
          throw new Error(
            `Invalid lastUsedBefore filter: "${args.filter.lastUsedBefore}" is not a valid date`,
          );
        }
        if (lastUsedDate < thresholdDate) {
          return true;
        }
      }

      // Check neverUsedAndCreatedBefore filter, deployment has NEVER been used AND was created before threshold
      if (args.filter.neverUsedAndCreatedBefore && !hasBeenUsed) {
        const createdAtDate = new Date(deployment.createdAt);
        const thresholdDate = new Date(args.filter.neverUsedAndCreatedBefore);
        if (Number.isNaN(thresholdDate.getTime())) {
          throw new Error(
            `Invalid neverUsedAndCreatedBefore filter: "${args.filter.neverUsedAndCreatedBefore}" is not a valid date`,
          );
        }
        if (createdAtDate < thresholdDate) {
          return true;
        }
      }

      return false;
    });

    this.logger.debug(
      'after filter: %d deployments match criteria (targetId=%s)',
      filteredDeployments.length,
      args.targetId,
    );

    // apply cursor-based pagination
    // Order is: created_at DESC, id ASC
    // Items after cursor have: smaller created_at OR (same created_at AND larger id)
    // Note: Compare ISO strings directly to preserve microsecond precision (JS Date loses it)
    let paginatedDeployments = filteredDeployments;
    if (cursor) {
      paginatedDeployments = filteredDeployments.filter(deployment => {
        if (deployment.createdAt < cursor.createdAt) return true;
        if (deployment.createdAt === cursor.createdAt && deployment.id > cursor.id) return true;
        return false;
      });
    }

    // Apply limit
    const hasNextPage = paginatedDeployments.length > limit;
    const items = paginatedDeployments.slice(0, limit).map(node => ({
      cursor: encodeCreatedAtAndUUIDIdBasedCursor(node),
      node,
    }));

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

  async getAppDeploymentTrafficPercentage(args: {
    targetId: string;
    appName: string;
    appVersion: string;
    periodDays: number;
  }): Promise<{
    trafficPercentage: number;
    totalOperations: number;
    appDeploymentOperations: number;
  } | null> {
    const periodFrom = startOfDay(subDays(new Date(), args.periodDays));

    const periodTo = new Date();

    const result = await this.clickhouse.query({
      query: cSql`
        SELECT
          SUM(CASE WHEN "client_name" = ${args.appName} AND "client_version" = ${args.appVersion} THEN "total" ELSE 0 END) AS "appDeploymentOps"
          , SUM("total") AS "totalOps"
        FROM "operations_daily"
        WHERE
          "target" = ${args.targetId}
          AND "timestamp" >= parseDateTimeBestEffort(${periodFrom.toISOString()})
          AND "timestamp" <= parseDateTimeBestEffort(${periodTo.toISOString()})
      `,
      queryId: 'get-app-deployment-traffic-percentage',
      timeout: 20_000,
    });

    const model = z.array(
      z.object({
        appDeploymentOps: z.string().transform(str => parseInt(str, 10)),
        totalOps: z.string().transform(str => parseInt(str, 10)),
      }),
    );

    const parsed = model.parse(result.data);

    if (parsed.length === 0 || parsed[0].totalOps === 0) {
      return null;
    }

    const { appDeploymentOps, totalOps } = parsed[0];

    return {
      trafficPercentage: (appDeploymentOps / totalOps) * 100,
      totalOperations: totalOps,
      appDeploymentOperations: appDeploymentOps,
    };
  }
}

const appDeploymentFields = psql`
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

export type AffectAppDeploymentsBySchemaCoordinate = Map<string, AffectedAppDeployments>;
