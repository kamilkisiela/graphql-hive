import { IdTranslator } from '../shared/providers/id-translator';
import { SupportModule } from './__generated__/types';
import { SupportTicketPriority, SupportTicketStatus } from './../../shared/entities';
import { SupportManager } from './providers/support-manager';

export const resolvers: SupportModule.Resolvers & {
  SupportTicketPriority: {
    [K in SupportModule.SupportTicketPriority]: SupportTicketPriority;
  };
  SupportTicketStatus: {
    [K in SupportModule.SupportTicketStatus]: SupportTicketStatus;
  };
} = {
  Mutation: {
    async supportTicketCreate(_, { input }, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
      const response = await injector.get(SupportManager).createTicket({
        organizationId,
        ...input,
      });

      return response;
    },
    async supportTicketReply(_, { input }, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
      const response = await injector.get(SupportManager).replyToTicket({
        organizationId,
        ...input,
      });

      return response;
    },
  },
  Organization: {
    async supportTickets(org, args, { injector }) {
      const response = await injector.get(SupportManager).getTickets(org.id);

      return {
        edges: response.nodes.map(ticket => ({
          node: {
            id: String(ticket.id),
            status: ticket.status,
            priority: ticket.priority,
            description: ticket.description,
            subject: ticket.subject,
            createdAt: ticket.created_at,
            updatedAt: ticket.updated_at,
          },
          cursor: String(ticket.id),
        })),
        pageInfo: {
          endCursor: String(response.nodes[response.nodes.length - 1]?.id ?? ''),
          hasNextPage: response.meta.has_more,
          hasPreviousPage: false,
          startCursor: String(response.nodes[0]?.id ?? ''),
        },
      };
    },
    async supportTicket(org, args, { injector }) {
      const ticket = await injector.get(SupportManager).getTicket(org.id, args.id);

      if (!ticket) {
        return null;
      }

      return {
        id: String(ticket.id),
        status: ticket.status,
        priority: ticket.priority,
        description: ticket.description,
        subject: ticket.subject,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
      };
    },
  },
  SupportTicket: {
    async comments(ticket, args, { injector }) {
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
  },
  SupportTicketStatus: {
    OPEN: SupportTicketStatus.OPEN,
    SOLVED: SupportTicketStatus.SOLVED,
  },
  SupportTicketPriority: {
    NORMAL: SupportTicketPriority.NORMAL,
    HIGH: SupportTicketPriority.HIGH,
    URGENT: SupportTicketPriority.URGENT,
  },
};
