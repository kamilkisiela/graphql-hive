import type { AdminOrganizationStats } from '../../shared/entities';

export type AdminQueryMapper = {};
export type AdminStatsMapper = {
  period: {
    from: string;
    to: string;
  };
  resolution: number;
};
export type AdminGeneralStatsMapper = AdminStatsMapper;
export type AdminOrganizationStatsMapper = AdminOrganizationStats;
