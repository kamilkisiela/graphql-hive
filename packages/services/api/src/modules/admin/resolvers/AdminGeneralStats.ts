import { parseDateRangeInput } from '../../../shared/helpers';
import { AdminManager } from '../providers/admin-manager';
import type { AdminGeneralStatsResolvers } from './../../../__generated__/types.next';

export const AdminGeneralStats: AdminGeneralStatsResolvers = {
  operationsOverTime: ({ period, resolution }, _, { injector }) => {
    const dateRange = parseDateRangeInput(period);
    return injector.get(AdminManager).getOperationsOverTime({
      period: {
        from: dateRange.from,
        to: dateRange.to,
      },
      resolution,
    });
  },
};
