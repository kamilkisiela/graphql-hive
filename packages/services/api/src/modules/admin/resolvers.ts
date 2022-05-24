import { AdminManager } from './providers/admin-manager';
import { AdminModule } from './__generated__/types';

export const resolvers: AdminModule.Resolvers = {
  Query: {
    admin() {
      return {};
    },
  },
  AdminQuery: {
    stats(_, { daysLimit }) {
      return {
        daysLimit,
      };
    },
  },
  AdminStats: {
    organizations({ daysLimit }, __, { injector }) {
      return injector.get(AdminManager).getStats(daysLimit);
    },
    general({ daysLimit }) {
      return { daysLimit };
    },
  },
  AdminGeneralStats: {
    operationsOverTime({ daysLimit }, _, { injector }) {
      return injector.get(AdminManager).getOperationsOverTime({
        // Max days limit is 30 (that's the default TTL in ClickHouse table)
        daysLimit: daysLimit ?? 30,
      });
    },
  },
  AdminOrganizationStats: {
    async operations(stats, _, { injector }) {
      const results = await injector.get(AdminManager).countOperationsPerOrganization({
        // Max days limit is 30 (that's the default TTL in ClickHouse table)
        daysLimit: stats.daysLimit ?? 30,
      });

      return results.find(r => r.organization === stats.organization.id)?.total ?? 0;
    },
  },
};
