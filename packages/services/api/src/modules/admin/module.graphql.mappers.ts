import type { Scalars } from '../../__generated__/types.next';
import type { AdminOrganizationStats } from '../../shared/entities';

export type AdminQueryMapper = {};
export type AdminStatsMapper = {
  period: {
    from: Scalars['DateTime']['output'];
    to: Scalars['DateTime']['output'];
  };
  resolution: number;
};
export type AdminGeneralStatsMapper = AdminStatsMapper;
export type AdminOrganizationStatsMapper = AdminOrganizationStats;
