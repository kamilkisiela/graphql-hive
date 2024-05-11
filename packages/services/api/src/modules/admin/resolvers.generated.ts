/* This file was automatically generated. DO NOT UPDATE MANUALLY. */
import type { Resolvers } from './../../__generated__/types.next';
import { AdminGeneralStats } from './resolvers/AdminGeneralStats';
import { AdminOperationPoint } from './resolvers/AdminOperationPoint';
import { AdminOrganizationStats } from './resolvers/AdminOrganizationStats';
import { AdminQuery } from './resolvers/AdminQuery';
import { AdminStats } from './resolvers/AdminStats';
import { admin as Query_admin } from './resolvers/Query/admin';

export const resolvers: Resolvers = {
  Query: { admin: Query_admin },

  AdminGeneralStats: AdminGeneralStats,
  AdminOperationPoint: AdminOperationPoint,
  AdminOrganizationStats: AdminOrganizationStats,
  AdminQuery: AdminQuery,
  AdminStats: AdminStats,
};
