import type { QueryResolvers } from './../../../../__generated__/types.next';

// TODO: Implement Query.auditLogExports resolver
export const auditLogExports: NonNullable<QueryResolvers['auditLogExports']> = async (
  _parent,
  _arg,
  _ctx,
) => {
  return {
    edges: [
      {
        cursor: 'cursor',
        node: {
          createdAt: '2021-09-01T00:00:00Z',
          id: 'id',
          url: 'url',
          validUntil: '2021-09-01T00:00:00Z',
          __typename: 'AuditLogFileExport',
        },
        __typename: 'ExportResultEdge',
      },
    ],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: 'startCursor',
      endCursor: 'endCursor',
    },
    __typename: 'ExportResultConnection',
  };
};
