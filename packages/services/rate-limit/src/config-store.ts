import LRU from 'tiny-lru';
import { createStorage } from '@hive/storage';

export const DEFAULT_RETENTION = 30; // days

export type RateLimitOrganizationConfig = {
  id: string;
  name: string;
  cleanId: string;
  ownerEmail: string;
  limit: number;
  retentionInDays: number;
  billingCycleDay: number;
  plan: string;
};

export function createOrganizationConfigStore(config: {
  postgres$: ReturnType<typeof createStorage>;
  cache: {
    max: number;
    ttl: number;
  };
}) {
  const organizationIdToConfig = LRU<RateLimitOrganizationConfig>(
    config.cache.max,
    config.cache.ttl,
  );

  return {
    async get(orgId: string): Promise<RateLimitOrganizationConfig> {
      const storage = await config.postgres$;

      if (organizationIdToConfig.has(orgId)) {
        return organizationIdToConfig.get(orgId)!;
      }

      const [org, orgBilling] = await Promise.all([
        storage.getOrganizationsRateLimitInfo(orgId),
        storage.getOrganizationBilling({ organization: orgId }),
      ]);

      if (!org) {
        throw new Error(`Organization "${orgId}" not found`);
      }

      const record: RateLimitOrganizationConfig = {
        id: orgId,
        name: org.org_name,
        cleanId: org.org_clean_id,
        ownerEmail: org.owner_email,
        billingCycleDay: orgBilling?.billingDayOfMonth ?? 1,
        limit: org.limit_operations_monthly ?? 0,
        plan: org.org_plan_name,
        retentionInDays: org.limit_retention_days ?? DEFAULT_RETENTION,
      };

      organizationIdToConfig.set(orgId, record);

      return record;
    },
  };
}
