import { endOfMonth, startOfMonth } from 'date-fns';
import type { ServiceLogger } from '@hive/service-common';
import { traceInline } from '@hive/service-common';
import { createStorage as createPostgreSQLStorage, Interceptor } from '@hive/storage';
import type { UsageEstimatorApi } from '@hive/usage-estimator';
import * as Sentry from '@sentry/node';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import type { RateLimitInput } from './api';
import { createEmailScheduler } from './emails';
import { rateLimitOperationsEventOrg } from './metrics';

export type RateLimitCheckResponse = {
  /**
   * An indicator that refers to the hard-limit state of the org.
   * If this is set to "true" -> usage is limited and no data is processed.
   */
  limited: boolean;
  /**
   * An indicator that tells about the usage of the org. We are using that for UI indicators.
   * This is a number between 0-1 (or higher in case of non-limited orgs)
   */
  usagePercentage: number;
  quota: number;
  current: number;
};

const UNKNOWN_RATE_LIMIT_OBJ: RateLimitCheckResponse = {
  current: -1,
  quota: -1,
  usagePercentage: 0,
  limited: false,
};

export type CachedRateLimitInfo = {
  orgName: string;
  orgEmail: string;
  orgPlan: string;
  orgSlug: string;
  operations: RateLimitCheckResponse;
  retentionInDays: number;
};

// It should be equal or higher than the highest possible retention value (enterprise),
// to prevent applying lower retention value then expected.
const RETENTION_IN_DAYS_FALLBACK = 365;

export type Limiter = ReturnType<typeof createRateLimiter>;

type OrganizationId = string;
type TargetId = string;

export function createRateLimiter(config: {
  logger: ServiceLogger;
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
    additionalInterceptors?: Interceptor[];
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
  const postgres$ = createPostgreSQLStorage(
    config.storage.connectionString,
    1,
    config.storage.additionalInterceptors,
  );
  let initialized = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  let targetIdToOrgLookup = new Map<TargetId, OrganizationId>();
  let cachedResult = new Map<OrganizationId, CachedRateLimitInfo>();

  const fetchAndCalculateUsageInformation = traceInline('Calculate Rate Limit', {}, async () => {
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
      storage.getGetOrganizationsAndTargetsWithLimitInfo(),
      rateEstimator.estimateOperationsForAllTargets.query(windowAsString),
    ]);

    const totalTargets = records.reduce((acc, record) => acc + record.targets.length, 0);

    logger.debug(
      `Fetched total of ${Object.keys(records).length} organizations (with ${totalTargets} targets) from the DB`,
    );
    logger.debug(
      `Fetched total of ${Object.keys(operations).length} targets with usage information`,
    );

    const newTargetIdToOrgLookup = new Map<TargetId, OrganizationId>();
    const newCachedResult = new Map<OrganizationId, CachedRateLimitInfo>();

    for (const record of records) {
      for (const target of record.targets) {
        newTargetIdToOrgLookup.set(target, record.organization);
      }
      if (!newCachedResult.has(record.organization)) {
        newCachedResult.set(record.organization, {
          orgName: record.org_name,
          orgEmail: record.owner_email,
          orgPlan: record.org_plan_name,
          orgSlug: record.org_clean_id,
          operations: {
            current: 0,
            quota: record.limit_operations_monthly,
            limited: false,
            usagePercentage: 0,
          },
          retentionInDays: record.limit_retention_days,
        });
      }

      const orgRecord = newCachedResult.get(record.organization)!;

      for (const target of record.targets) {
        orgRecord.operations.current += operations[target] || 0;
      }
    }

    newCachedResult.forEach((orgRecord, orgId) => {
      const orgName = orgRecord.orgName;
      // We do not really limit Enterprise customers, but we still want to track their usage.
      const noLimits = orgRecord.orgPlan === 'ENTERPRISE' || orgRecord.operations.quota === 0;
      orgRecord.operations.limited = noLimits
        ? false
        : orgRecord.operations.current > orgRecord.operations.quota;
      orgRecord.operations.usagePercentage =
        orgRecord.operations.current / orgRecord.operations.quota;

      if (orgRecord.operations.usagePercentage >= 1) {
        rateLimitOperationsEventOrg.labels({ orgId, orgName }).inc();
        logger.info(
          `Organization "${orgName}"/"${orgId}" is now being rate-limited for operations (${orgRecord.operations.current}/${orgRecord.operations.quota})`,
        );

        emails.limitExceeded({
          organization: {
            id: orgId,
            slug: orgRecord.orgSlug,
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
      } else if (orgRecord.operations.usagePercentage >= 0.9) {
        emails.limitWarning({
          organization: {
            id: orgId,
            slug: orgRecord.orgSlug,
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
  });

  function getOrganizationFromCache(targetId: string) {
    const orgId = targetIdToOrgLookup.get(targetId);
    return orgId ? cachedResult.get(orgId) : undefined;
  }

  return {
    logger,
    async readiness() {
      return initialized && (await (await postgres$).isReady());
    },
    getRetention(targetId: string) {
      const orgData = getOrganizationFromCache(targetId);

      if (!orgData) {
        // This is a safety measure to prevent setting the retention to a lower value then expected,
        // in case of an organization data not being available yet in the cache.
        const error = new Error(
          `Failed to resolve/find retention information for targetId=${targetId}`,
        );
        Sentry.captureException(error, {
          level: 'error',
        });
        logger.error(error);
        return RETENTION_IN_DAYS_FALLBACK;
      }

      return orgData.retentionInDays;
    },
    checkLimit(input: RateLimitInput): RateLimitCheckResponse {
      const orgId =
        input.entityType === 'organization' ? input.id : targetIdToOrgLookup.get(input.id);

      if (!orgId) {
        const error = new Error(
          `Failed to resolve/find rate limit information for entityId=${input.id} type=${input.entityType}`,
        );
        Sentry.captureException(error, {
          level: 'error',
        });
        logger.error(error);

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

      const pollFn = traceInline('Rate Limit Background Refresh', {}, async () => {
        logger.info(`Interval triggered, updating interval rate-limit cache...`);

        try {
          await fetchAndCalculateUsageInformation();
        } catch (error) {
          logger.error(error, `Failed to update rate-limit cache`);
          Sentry.captureException(error, {
            level: 'error',
          });
        }
      });

      intervalHandle = setInterval(pollFn, config.rateLimitConfig.interval);
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
