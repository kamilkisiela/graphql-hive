import { SupportManager } from '../providers/support-manager';
import type { SupportTicketResolvers } from './../../../__generated__/types.next';

export const SupportTicket: SupportTicketResolvers = {
  comments: async (ticket, _args, { injector }) => {
    const response = await injector.get(SupportManager).getTicketComments(ticket.id);

    return {
      edges: response.nodes.map(comment => ({
        node: {
          id: String(comment.id),
          body: comment.body,
          createdAt: comment.created_at,
          fromSupport: comment.fromSupport,
        },
        cursor: String(comment.id),
      })),
      pageInfo: {
        endCursor: String(response.nodes[response.nodes.length - 1]?.id ?? ''),
        hasNextPage: response.meta.has_more,
        hasPreviousPage: false,
        startCursor: String(response.nodes[0]?.id ?? ''),
      },
    };
  },
};
