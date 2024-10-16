import { GraphQLError } from 'graphql';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { AuditLogManager } from '../../providers/audit-logs-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const auditLogs: NonNullable<QueryResolvers['auditLogs']> = async (_parent, args, ctx) => {
  const isOwner = ctx.injector.get(AuthManager).ensureOrganizationOwnership({
    organization: args.selector.organization,
  });
  if (!isOwner) {
    throw new GraphQLError('Unauthorized: You are not authorized to perform this action');
  }

  const { selector, filter, pagination } = args;
  const auditLogs = await ctx.injector.get(AuditLogManager).getPaginatedAuditLogs({
    selector: selector,
    filter: filter,
    pagination: pagination,
  });

  return {
    nodes: auditLogs.data,
    total: auditLogs.total,
    __typename: 'AuditLogConnection',
  };
};
