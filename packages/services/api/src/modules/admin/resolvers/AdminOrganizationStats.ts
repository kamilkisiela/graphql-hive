import { AdminManager } from '../providers/admin-manager';
import type { AdminOrganizationStatsResolvers } from './../../../__generated__/types.next';

export const AdminOrganizationStats: AdminOrganizationStatsResolvers = {
  operations: async (stats, _arg, { injector }) => {
    const results = await injector.get(AdminManager).countOperationsPerOrganization({
      period: stats.period,
    });

    return results.find(r => r.organization === stats.organization.id)?.total ?? 0;
  },
};
