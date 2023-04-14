import { endOfMonth, startOfMonth } from 'date-fns';
import type { FastifyLoggerInstance } from '@hive/service-common';
import { createStorage as createPostgreSQLStorage } from '@hive/storage';
import type { UsageEstimatorApi } from '@hive/usage-estimator';
import * as Sentry from '@sentry/node';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import type { RateLimitInput } from './api';
import { createEmailScheduler } from './emails';
import { rateLimitOperationsEventOrg } from './metrics';

export type RateLimitCheckResponse = {
  limited: boolean;
  quota: number;
  current: number;
};

const UNKNOWN_RATE_LIMIT_OBJ: RateLimitCheckResponse = {
  current: -1,
  quota: -1,
  limited: false,
};

export type CachedRateLimitInfo = {
  orgName: string;
  orgEmail: string;
  orgCleanId: string;
  operations: RateLimitCheckResponse;
  retentionInDays: number;
};

const DEFAULT_RETENTION = 30; // days

export type Limiter = ReturnType<typeof createRateLimiter>;

type OrganizationId = string;
type TargetId = string;

export function createRateLimiter(config: {
  logger: FastifyLoggerInstance;
  rateLimitConfig: {
    interval: number;
  };
  rateEstimator: {
    endpoint: string;
  };
  emails?: {
    endpoint: string;
  };
  storage: {
    connectionString: string;
  };
}) {
  const rateEstimator = createTRPCProxyClient<UsageEstimatorApi>({
    links: [
      httpLink({
        url: `${config.rateEstimator.endpoint}/trpc`,
        fetch,
      }),
    ],
  });
  const emails = createEmailScheduler(config.emails);

  const { logger } = config;
  const postgres$ = createPostgreSQLStorage(config.storage.connectionString, 1);
  let initialized = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  let targetIdToOrgLookup = new Map<TargetId, OrganizationId>();
  let cachedResult = new Map<OrganizationId, CachedRateLimitInfo>();

  async function fetchAndCalculateUsageInformation() {
    const now = new Date();
    const window = {
      startTime: startOfMonth(now),
      endTime: endOfMonth(now),
    };
    const windowAsString = {
      startTime: startOfMonth(now).toUTCString(),
      endTime: endOfMonth(now).toUTCString(),
    };
    config.logger.info(
      `Calculating rate-limit information based on window: ${windowAsString.startTime} -> ${windowAsString.endTime}`,
    );
    const storage = await postgres$;

    const [records, operations] = await Promise.all([
      storage.getGetOrganizationsAndTargetPairsWithLimitInfo(),
      rateEstimator.estimateOperationsForAllTargets.query(windowAsString),
    ]);

    logger.debug(`Fetched total of ${Object.keys(records).length} targets from the DB`);
    logger.debug(
      `Fetched total of ${Object.keys(operations).length} targets with usage information`,
    );

    const newTargetIdToOrgLookup = new Map<TargetId, OrganizationId>();
    const newCachedResult = new Map<OrganizationId, CachedRateLimitInfo>();

    for (const pairRecord of records) {
      newTargetIdToOrgLookup.set(pairRecord.target, pairRecord.organization);

      if (!newCachedResult.has(pairRecord.organization)) {
        newCachedResult.set(pairRecord.organization, {
          orgName: pairRecord.org_name,
          orgEmail: pairRecord.owner_email,
          orgCleanId: pairRecord.org_clean_id,
          operations: {
            current: 0,
            quota: pairRecord.limit_operations_monthly,
            limited: false,
          },
          retentionInDays: pairRecord.limit_retention_days,
        });
      }

      const orgRecord = newCachedResult.get(pairRecord.organization)!;
      orgRecord.operations.current =
        (orgRecord.operations.current || 0) + (operations[pairRecord.target] || 0);
    }

    newCachedResult.forEach((orgRecord, orgId) => {
      const orgName = orgRecord.orgName;
      const noLimits = orgRecord.operations.quota === 0;
      orgRecord.operations.limited = noLimits
        ? false
        : orgRecord.operations.current > orgRecord.operations.quota;

      if (orgRecord.operations.limited) {
        rateLimitOperationsEventOrg.labels({ orgId, orgName }).inc();
        logger.info(
          `Organization "${orgName}"/"${orgId}" is now being rate-limited for operations (${orgRecord.operations.current}/${orgRecord.operations.quota})`,
        );

        emails.limitExceeded({
          organization: {
            id: orgId,
            cleanId: orgRecord.orgCleanId,
            name: orgName,
            email: orgRecord.orgEmail,
          },
          period: {
            start: window.startTime.getTime(),
            end: window.endTime.getTime(),
          },
          usage: {
            quota: orgRecord.operations.quota,
            current: orgRecord.operations.current,
          },
        });
      } else if (orgRecord.operations.current / orgRecord.operations.quota >= 0.9) {
        emails.limitWarning({
          organization: {
            id: orgId,
            cleanId: orgRecord.orgCleanId,
            name: orgName,
            email: orgRecord.orgEmail,
          },
          period: {
            start: window.startTime.getTime(),
            end: window.endTime.getTime(),
          },
          usage: {
            quota: orgRecord.operations.quota,
            current: orgRecord.operations.current,
          },
        });
      }
    });

    cachedResult = newCachedResult;
    targetIdToOrgLookup = newTargetIdToOrgLookup;

    const scheduledEmails = emails.drain();
    if (scheduledEmails.length > 0) {
      await Promise.all(scheduledEmails);
      logger.info(`Scheduled ${scheduledEmails.length} emails`);
    }
  }

  return {
    logger,
    async readiness() {
      return initialized && (await (await postgres$).isReady());
    },
    getRetention(targetId: string) {
      const orgId = targetIdToOrgLookup.get(targetId);

      if (!orgId) {
        return DEFAULT_RETENTION;
      }

      const orgData = cachedResult.get(orgId);

      if (!orgData) {
        return DEFAULT_RETENTION;
      }

      return orgData.retentionInDays;
    },
    checkLimit(input: RateLimitInput): RateLimitCheckResponse {
      const orgId =
        input.entityType === 'organization' ? input.id : targetIdToOrgLookup.get(input.id);

      if (!orgId) {
        logger.warn(
          `Failed to resolve/find rate limit information for entityId=${input.id} (type=${input.entityType})`,
        );

        return UNKNOWN_RATE_LIMIT_OBJ;
      }

      const orgData = cachedResult.get(orgId);

      if (!orgData) {
        return UNKNOWN_RATE_LIMIT_OBJ;
      }

      if (input.type === 'operations-reporting') {
        return orgData.operations;
      }
      return UNKNOWN_RATE_LIMIT_OBJ;
    },
    async start() {
      logger.info(
        `Rate Limiter starting, will update rate-limit information every ${config.rateLimitConfig.interval}ms`,
      );
      await fetchAndCalculateUsageInformation().catch(e => {
        logger.error(e, `Failed to fetch rate-limit info from usage-estimator, error: `);
      });

      initialized = true;
      intervalHandle = setInterval(async () => {
        logger.info(`Interval triggered, updating interval rate-limit cache...`);

        try {
          await fetchAndCalculateUsageInformation();
        } catch (error) {
          logger.error(error, `Failed to update rate-limit cache`);
          Sentry.captureException(error, {
            level: 'error',
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
      await (await postgres$).destroy();
      logger.info('Rate Limiter stopped');
    },
  };
}
