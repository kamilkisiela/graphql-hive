import { fetch } from 'cross-undici-fetch';
import type { FastifyLoggerInstance } from '@hive/service-common';
import { createStorage as createPostgreSQLStorage } from '@hive/storage';

import { startOfMonth, endOfMonth } from 'date-fns';
import * as Sentry from '@sentry/node';
import { createTRPCClient } from '@trpc/client';
import type { UsageEstimatorApi } from '@hive/usage-estimator';
import type { RateLimitInput } from './api';
import { rateLimitOperationsEventOrg, rateLimitSchemaEventOrg } from './metrics';

export type RateLimitCheckResponse = {
  limited: boolean;
  quota?: number;
  current?: number;
};

const DEFAULT_RETENTION = 30; // days

export type Limiter = ReturnType<typeof createRateLimiter>;

export function createRateLimiter(config: {
  logger: FastifyLoggerInstance;
  rateLimitConfig: {
    interval: number;
  };
  rateEstimator: {
    endpoint: string;
  };
  storage: {
    connectionString: string;
  };
}) {
  const rateEstimator = createTRPCClient<UsageEstimatorApi>({
    url: `${config.rateEstimator.endpoint}/trpc`,
    fetch,
  });

  const { logger } = config;
  const postgres$ = createPostgreSQLStorage(config.storage.connectionString);
  let initialized = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let targetIdToRateLimitStatus = {
    orgToTargetIdMap: new Map<string, string>(),
    retention: new Map<string, number>(),
    operationsReporting: new Map<string, RateLimitCheckResponse>(),
    schemaPushes: new Map<string, RateLimitCheckResponse>(),
  };

  async function fetchAndCalculateUsageInformation() {
    const now = new Date();
    const window = {
      startTime: startOfMonth(now).toUTCString(),
      endTime: endOfMonth(now).toUTCString(),
    };
    config.logger.info(`Calculating rate-limit information based on window: ${window.startTime} -> ${window.endTime}`);
    const storage = await postgres$;
    const newMap: typeof targetIdToRateLimitStatus = {
      orgToTargetIdMap: new Map<string, string>(),
      retention: new Map<string, number>(),
      operationsReporting: new Map<string, RateLimitCheckResponse>(),
      schemaPushes: new Map<string, RateLimitCheckResponse>(),
    };

    const [records, operations, pushes] = await Promise.all([
      storage.getGetOrganizationsAndTargetPairsWithLimitInfo(),
      rateEstimator.query('estimateOperationsForAllTargets', window),
      rateEstimator.query('estiamteSchemaPushesForAllTargets', window),
    ]);

    logger.debug(`Fetched total of ${Object.keys(records).length} targets from the DB`);
    logger.debug(`Fetched total of ${Object.keys(operations).length} targets with usage information`);
    logger.debug(`Fetched total of ${Object.keys(pushes).length} targets with schema push information`);

    for (const record of records) {
      newMap.orgToTargetIdMap.set(record.organization, record.target);
      const currentOperations = operations[record.target] || 0;
      const operationsLimited =
        record.limit_operations_monthly === 0 ? false : record.limit_operations_monthly < currentOperations;

      newMap.retention.set(record.target, record.limit_retention_days);

      newMap.operationsReporting.set(record.target, {
        current: currentOperations,
        quota: record.limit_operations_monthly,
        limited: operationsLimited,
      });

      const currentPushes = pushes[record.target] || 0;
      const pushLimited =
        record.limit_schema_push_monthly === 0 ? false : record.limit_schema_push_monthly < currentPushes;
      newMap.schemaPushes.set(record.target, {
        current: currentPushes,
        quota: record.limit_schema_push_monthly,
        limited: pushLimited,
      });

      if (operationsLimited) {
        rateLimitOperationsEventOrg
          .labels({
            orgId: record.organization,
          })
          .inc();
        logger.info(
          `Target="${record.target}" (org="${record.organization}") is now being rate-limited for operations (${currentOperations}/${record.limit_operations_monthly})`
        );
      }

      if (pushLimited) {
        rateLimitSchemaEventOrg
          .labels({
            orgId: record.organization,
          })
          .inc();
        logger.info(
          `Target="${record.target}" (org="${record.organization}") is now being rate-limited for schema pushes (${currentPushes}/${record.limit_schema_push_monthly})`
        );
      }
    }

    targetIdToRateLimitStatus = newMap;
  }

  return {
    readiness() {
      return initialized;
    },
    getRetention(targetId: string) {
      const map = targetIdToRateLimitStatus.retention;

      if (map.has(targetId)) {
        return map.get(targetId)!;
      } else {
        // In case we don't have any knowledge on that target id, to use the default.
        return DEFAULT_RETENTION;
      }
    },
    checkLimit(input: RateLimitInput): RateLimitCheckResponse {
      logger.info(`Rate-limit check triggered, input is: ${input}`);

      const map =
        input.type === 'operations-reporting'
          ? targetIdToRateLimitStatus.operationsReporting
          : targetIdToRateLimitStatus.schemaPushes;

      const entityId =
        input.entityType === 'target' ? input.id : targetIdToRateLimitStatus.orgToTargetIdMap.get(input.id);

      if (!entityId) {
        logger.warn(
          `Failed to resolve/find rate limit information for entityId=${entityId} (type=${input.entityType})`
        );

        return {
          limited: false,
        };
      }

      if (map.has(entityId)) {
        return map.get(entityId)!;
      } else {
        // In case we don't have any knowledge on that target id, we allow it to run
        return {
          limited: false,
        };
      }
    },
    async start() {
      logger.info(
        `Rate Limiter starting, will update rate-limit information every ${config.rateLimitConfig.interval}ms`
      );
      await fetchAndCalculateUsageInformation().catch(e => {
        logger.error(e, `Failed to fetch rate-limit info from usage-estimator, error: `);
      });

      initialized = true;
      intervalHandle = setInterval(async () => {
        logger.info(`Interval triggered, updating internval rate-limit cache...`);

        try {
          await fetchAndCalculateUsageInformation();
        } catch (error) {
          logger.error(error, `Failed to update rate-limit cache`);
          Sentry.captureException(error, {
            level: Sentry.Severity.Error,
          });
        }
      }, config.rateLimitConfig.interval);
    },
    async stop() {
      initialized = false; // to make readiness check == false
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
      logger.info('Rate Limiter stopped');
    },
  };
}
