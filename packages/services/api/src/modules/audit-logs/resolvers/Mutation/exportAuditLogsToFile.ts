import type { MutationResolvers } from './../../../../__generated__/types.next';

// TODO: Export audit logs to a file
export const exportAuditLogsToFile: NonNullable<
  MutationResolvers['exportAuditLogsToFile']
> = async (_parent, _arg, _ctx) => {
  /* Implement Mutation.exportAuditLogsToFile resolver logic here */
  return {
    createdAt: '2021-09-01T00:00:00Z',
    id: 'id',
    url: 'url',
    validUntil: '2021-09-01T00:00:00Z',
    __typename: 'AuditLogFileExport',
  };
};
