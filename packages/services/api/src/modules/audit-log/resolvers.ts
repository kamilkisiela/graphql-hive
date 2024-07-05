import { AuditLogModule } from './__generated__/types';

export const resolvers: AuditLogModule.Resolvers = {
  Mutation: {
    exportAuditLogsToFile: async (_, {input}, { injector }) => {
      // Implement Mutation.exportAuditLogsToFile resolver logic here
      input
    },
  },
};
