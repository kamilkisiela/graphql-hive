import { AdminModule } from './__generated__/types';
import { AdminManager } from './providers/admin-manager';

export const resolvers: AdminModule.Resolvers = {
  Query: {
    admin() {
      return {};
    },
  },
  AdminQuery: {
    stats(_, { period }) {
      return {
        period,
      };
    },
  },
  AdminStats: {
    organizations({ period }, __, { injector }) {
      return injector.get(AdminManager).getStats({
        from: new Date(period.from),
        to: new Date(period.to),
      });
    },
    general({ period }) {
      return { period };
    },
  },
  AdminGeneralStats: {
    operationsOverTime({ period }, _, { injector }) {
      return injector.get(AdminManager).getOperationsOverTime({
        period: {
          from: new Date(period.from),
          to: new Date(period.to),
        },
      });
    },
  },
  AdminOrganizationStats: {
    async operations(stats, _, { injector }) {
      const results = await injector.get(AdminManager).countOperationsPerOrganization({
        period: stats.period,
      });

      return results.find(r => r.organization === stats.organization.id)?.total ?? 0;
    },
  },
};
