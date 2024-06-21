import { AdminModule } from './__generated__/types';
import { AdminManager } from './providers/admin-manager';

export const resolvers: AdminModule.Resolvers = {
  AdminOrganizationStats: {
    async operations(stats, _, { injector }) {
      const results = await injector.get(AdminManager).countOperationsPerOrganization({
        period: stats.period,
      });

      return results.find(r => r.organization === stats.organization.id)?.total ?? 0;
    },
  },
};
