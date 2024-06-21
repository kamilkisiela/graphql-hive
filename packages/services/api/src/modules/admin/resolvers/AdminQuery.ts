import type { AdminQueryResolvers } from './../../../__generated__/types.next';

export const AdminQuery: AdminQueryResolvers = {
  stats: async (_, { period, resolution }) => {
    return {
      period,
      resolution,
    };
  },
};
