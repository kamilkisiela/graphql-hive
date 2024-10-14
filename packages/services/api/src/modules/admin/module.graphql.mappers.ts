import type { Scalars } from '../../__generated__/types.next';
import type { AdminOrganizationStats } from '../../shared/entities';

export type AdminQueryMapper = {};
export type AdminStatsMapper = {
  period: {
    from: Scalars['DateTime']['input'];
    to: Scalars['DateTime']['input'];
  };
  resolution: number;
};
export type AdminGeneralStatsMapper = AdminStatsMapper;
export type AdminOrganizationStatsMapper = AdminOrganizationStats;
