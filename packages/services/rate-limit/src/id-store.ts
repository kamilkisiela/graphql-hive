import { type ServiceLogger } from '@hive/service-common';
import { createStorage } from '@hive/storage';

export function createOrganizationIdStore(config: {
  logger: ServiceLogger;
  refreshIntervalMs: number;
  postgres$: ReturnType<typeof createStorage>;
}) {
  let targetIdToOrgLookup = new Map<string, string>();
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  async function load() {
    config.logger.info('Refreshing targetIdToOrgLookup data...');
    const storage = await config.postgres$;
    const pairs = await storage.getOrganizationsTargetPairs();
    const newMap = new Map<string, string>();

    for (const pair of pairs) {
      newMap.set(pair.target, pair.organization);
    }

    targetIdToOrgLookup = newMap;
    config.logger.info(`Updated local targetIdToOrgLookup data with ${pairs.length} entries.`);
  }

  return {
    lookup(targetId: string): string | null {
      return targetIdToOrgLookup.get(targetId) ?? null;
    },
    async reset() {
      await load();
    },
    async start() {
      await load();

      config.logger.info(
        `Starting createOrganizationIdStore data refresh in background... (interval=${config.refreshIntervalMs}ms)`,
      );
      intervalHandle = setInterval(load, config.refreshIntervalMs);
    },
    stop() {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
    },
  };
}
