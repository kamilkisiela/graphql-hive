/* This file was automatically generated. DO NOT UPDATE MANUALLY. */
import type { Resolvers } from './../../__generated__/types.next';
import { AdminStats } from './resolvers/AdminStats';
import { admin as Query_admin } from './resolvers/Query/admin';

export const resolvers: Resolvers = {
  Query: { admin: Query_admin },

  AdminStats: AdminStats,
};
