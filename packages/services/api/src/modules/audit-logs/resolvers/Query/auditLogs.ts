import { GraphQLError } from 'graphql';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { AuditLogManager } from '../../providers/audit-logs-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const auditLogs: NonNullable<QueryResolvers['auditLogs']> = async (_parent, args, ctx) => {
  const isAdmin = ctx.injector
    .get(AuthManager)
    .getCurrentUser()
    ?.then(user => user.isAdmin);
  if (!isAdmin) {
    throw new GraphQLError('Unauthorized: You are not authorized to perform this action');
  }

  const { selector, filter, pagination } = args;
  const auditLogs = await ctx.injector.get(AuditLogManager).getPaginatedAuditLogs({
    selector: selector,
    filter: filter,
    pagination: pagination,
  });

  console.log('auditLogs', auditLogs);

  return {
    nodes: auditLogs.data,
    total: auditLogs.total,
    __typename: 'AuditLogConnection',
  };
};
