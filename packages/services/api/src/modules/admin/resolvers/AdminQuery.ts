import type { AdminQueryResolvers } from './../../../__generated__/types.next';

export const AdminQuery: AdminQueryResolvers = {
  stats: (_, { period, resolution }) => {
    return {
      period,
      resolution,
    };
  },
};
