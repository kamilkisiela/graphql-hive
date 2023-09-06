import { createHash } from 'node:crypto';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import { Organization, SupportTicketPriority, SupportTicketStatus } from '../../../shared/entities';
import { atomic } from '../../../shared/helpers';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/scopes';
import { HttpClient } from '../../shared/providers/http-client';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { OrganizationManager } from './../../organization/providers/organization-manager';
import { SUPPORT_MODULE_CONFIG, type SupportConfig } from './config';

export const SupportTicketPriorityAPIModel = z.enum(['low', 'normal', 'high', 'urgent']);
export const SupportTicketStatusAPIModel = z.enum([
  'new',
  'pending',
  'open',
  'hold',
  'closed',
  'solved',
]);

export const SupportTicketPriorityModel = z.nativeEnum(SupportTicketPriority);
export const SupportTicketStatusModel = z.nativeEnum(SupportTicketStatus);

const SupportTicketModel = z.object({
  id: z.number(),
  organization_id: z.number(),
  priority: SupportTicketPriorityAPIModel.transform(value => {
    if (value === 'low') {
      value = 'normal';
    }

    return SupportTicketPriorityModel.parse(value);
  }),
  status: SupportTicketStatusAPIModel.transform(value => {
    if (value === 'new' || value === 'pending' || value === 'hold') {
      value = 'open';
    }

    if (value === 'closed') {
      value = 'solved';
    }

    return SupportTicketStatusModel.parse(value);
  }),
  created_at: z.string(),
  updated_at: z.string(),
  subject: z.string(),
  description: z.string(),
});

const SupportTicketCommentModel = z.object({
  id: z.number(),
  created_at: z.string(),
  public: z.boolean(),
  author_id: z.number(),
  type: z.enum(['Comment', 'VoiceComment']),
  body: z.string(),
});

const PaginationMetadataModel = z.object({
  has_more: z.boolean(),
});

const SupportTicketListModel = z.object({
  tickets: z.array(SupportTicketModel),
  meta: PaginationMetadataModel,
});

const SupportTicketResponseModel = z.object({
  ticket: SupportTicketModel,
});

const SupportTicketCommentListModel = z.object({
  comments: z.array(SupportTicketCommentModel),
  meta: PaginationMetadataModel,
});

const SupportTicketCreateRequestModel = z.object({
  organizationId: z.string(),
  subject: z.string().min(3),
  description: z.string().min(3),
  priority: SupportTicketPriorityModel,
});

const SupportTicketCreateResponseModel = z.object({
  ticket: z.object({
    id: z.number(),
  }),
});

const SupportTicketReplyRequestModel = z.object({
  organizationId: z.string(),
  ticketId: z.string(),
  body: z.string().min(1),
});

const SupportTicketReplyResponseModel = z.object({
  ticket: z.object({
    id: z.number(),
  }),
});

const SupportTicketAuthorModel = z.object({
  id: z.number(),
  role: z.enum(['end-user', 'agent', 'admin']),
});

const SupportTicketAuthorsResponseModel = z.object({
  users: z.array(SupportTicketAuthorModel),
});

const OrganizationCreateResponseModel = z.object({
  organization: z.object({
    id: z.number(),
  }),
});

const UserCreateResponseModel = z.object({
  user: z.object({
    id: z.number(),
  }),
});

@Injectable({
  scope: Scope.Operation,
})
export class SupportManager {
  private logger: Logger;

  constructor(
    @Inject(SUPPORT_MODULE_CONFIG) private config: SupportConfig,
    logger: Logger,
    private httpClient: HttpClient,
    private authManager: AuthManager,
    private organizationManager: OrganizationManager,
    private storage: Storage,
  ) {
    this.logger = logger.child({ service: 'SupportManager' });
  }

  @atomic((organizationId: string) => organizationId)
  private async ensureZendeskOrganizationId(organizationId: string): Promise<string> {
    const organization = await this.organizationManager.getOrganization({
      organization: organizationId,
    });

    if (organization.zendeskId) {
      return organization.zendeskId;
    }

    this.logger.info('Creating organization in zendesk (id: %s)', organizationId);
    const response = await this.httpClient
      .post(`https://${this.config.subdomain}.zendesk.com/api/v2/organizations`, {
        username: this.config.username,
        password: this.config.password,
        responseType: 'json',
        context: {
          logger: this.logger,
        },
        headers: {
          'idempotency-key': organizationId,
        },
        json: {
          organization: {
            name: `${organization.name} (${organization.id})`,
            external_id: organization.id,
          },
        },
      })
      .then(res =>
        OrganizationCreateResponseModel.parseAsync(res).catch(err => {
          this.logger.error(err);
          return Promise.reject(err);
        }),
      );
    const organizationZendeskId = String(response.organization.id);

    await this.storage.setZendeskOrganizationId({
      organizationId,
      zendeskId: organizationZendeskId,
    });

    return organizationZendeskId;
  }

  @atomic(
    (args: Parameters<SupportManager['ensureZendeskUserId']>[0]) =>
      args.userId + ':' + args.organizationId,
  )
  private async ensureZendeskUserId(input: {
    userId: string;
    organizationId: string;
  }): Promise<string> {
    const organizationZendeskId = await this.ensureZendeskOrganizationId(input.organizationId);

    const userAsMember = await this.organizationManager.getOrganizationMember({
      organization: input.organizationId,
      user: input.userId,
    });

    if (!userAsMember.user.zendeskId) {
      this.logger.info(
        'Creating user in zendesk organization (organization: %s, user: %s)',
        input.organizationId,
        input.userId,
      );
      const response = await this.httpClient
        .post(`https://${this.config.subdomain}.zendesk.com/api/v2/users`, {
          username: this.config.username,
          password: this.config.password,
          responseType: 'json',
          context: {
            logger: this.logger,
          },
          headers: {
            'idempotency-key': input.userId,
          },
          json: {
            user: {
              name: userAsMember.user.fullName,
              email: userAsMember.user.email,
              external_id: userAsMember.user.id,
              identities: [
                {
                  type: 'foreign',
                  value: userAsMember.user.email,
                },
              ],
              role: 'end-user',
              verified: true,
            },
            skip_verify_email: true,
          },
        })
        .then(res =>
          UserCreateResponseModel.parseAsync(res).catch(err => {
            this.logger.error(err);
            return Promise.reject(err);
          }),
        );
      const userZendeskId = String(response.user.id);
      await this.storage.setZendeskUserId({ userId: input.userId, zendeskId: userZendeskId });

      userAsMember.user.zendeskId = userZendeskId;
    }

    if (!userAsMember.connectedToZendesk) {
      this.logger.info(
        'Connecting user to zendesk organization (organization: %s, user: %s)',
        input.organizationId,
        input.userId,
      );
      // connect user to organization
      await this.httpClient.post(
        `https://${this.config.subdomain}.zendesk.com/api/v2/organization_memberships`,
        {
          username: this.config.username,
          password: this.config.password,
          responseType: 'json',
          context: {
            logger: this.logger,
          },
          headers: {
            'idempotency-key': input.userId + ':' + input.organizationId,
          },
          json: {
            organization_membership: {
              user_id: userAsMember.user.zendeskId,
              organization_id: organizationZendeskId,
            },
          },
        },
      );
      await this.storage.setZendeskOrganizationUserConnection({
        userId: input.userId,
        organizationId: input.organizationId,
      });
    }

    return userAsMember.user.zendeskId;
  }

  async getUsers(ids: number[]) {
    // To get a list of users, use the following endpoint:
    // GET /api/v2/users/show_many?ids=345678,901234
    // To detect if a user is a support user or customer, use the following property:
    // role - The user's role. Possible values are "end-user", "agent", or "admin"
    this.logger.info('Fetching ticket users (id: %s)', ids.join(','));

    const response = await this.httpClient
      .get(`https://${this.config.subdomain}.zendesk.com/api/v2/users/show_many`, {
        searchParams: {
          ids: ids.join(','),
        },
        username: this.config.username,
        password: this.config.password,
        responseType: 'json',
        context: {
          logger: this.logger,
        },
      })
      .then(res =>
        SupportTicketAuthorsResponseModel.parseAsync(res).catch(err => {
          this.logger.error(err);
          return Promise.reject(err);
        }),
      );

    return response.users.map(user => ({
      id: user.id,
      isSupport: user.role !== 'end-user',
    }));
  }

  async getTickets(organizationId: string) {
    this.logger.info('Fetching support tickets (id: %s)', organizationId);
    await this.authManager.ensureOrganizationAccess({
      organization: organizationId,
      scope: OrganizationAccessScope.READ,
    });
    const internalOrganizationId = await this.ensureZendeskOrganizationId(organizationId);

    const response = await this.httpClient
      .get(
        `https://${this.config.subdomain}.zendesk.com/api/v2/organizations/${internalOrganizationId}/tickets`,
        {
          searchParams: {
            sort: '-updated_at',
            'page[size]': 100,
          },
          username: this.config.username,
          password: this.config.password,
          responseType: 'json',
          context: {
            logger: this.logger,
          },
        },
      )
      .then(res =>
        SupportTicketListModel.parseAsync(res).catch(err => {
          this.logger.error(err);
          return Promise.reject(err);
        }),
      );

    return {
      nodes: response.tickets,
      meta: response.meta,
    };
  }

  async getTicket(organizationId: string, ticketId: string) {
    this.logger.info(
      'Fetching support ticket (organization: %s, ticket: %s)',
      organizationId,
      ticketId,
    );
    await this.authManager.ensureOrganizationAccess({
      organization: organizationId,
      scope: OrganizationAccessScope.READ,
    });
    const zendeskOrganizationId = await this.ensureZendeskOrganizationId(organizationId);

    const response = await this.httpClient
      .get(`https://${this.config.subdomain}.zendesk.com/api/v2/tickets/${ticketId}`, {
        username: this.config.username,
        password: this.config.password,
        responseType: 'json',
        context: {
          logger: this.logger,
        },
      })
      .then(res =>
        SupportTicketResponseModel.parseAsync(res).catch(err => {
          this.logger.error(err);
          return Promise.reject(err);
        }),
      );

    if (String(response.ticket.organization_id) !== zendeskOrganizationId) {
      this.logger.error(
        'Ticket does not belong to organization (ticket: %s, organization: %s)',
        ticketId,
        organizationId,
      );
      return null;
    }

    return response.ticket;
  }

  async getTicketComments(ticketId: string) {
    this.logger.info('Fetching support ticket comments (ticketId: %s)', ticketId);

    const response = await this.httpClient
      .get(`https://${this.config.subdomain}.zendesk.com/api/v2/tickets/${ticketId}/comments`, {
        searchParams: {
          sort: '-created_at',
          'page[size]': 100,
        },
        username: this.config.username,
        password: this.config.password,
        responseType: 'json',
        context: {
          logger: this.logger,
        },
      })
      .then(res =>
        SupportTicketCommentListModel.parseAsync(res).catch(err => {
          this.logger.error(err);
          return Promise.reject(err);
        }),
      );

    const comments = response.comments.filter(
      comment => comment.type === 'Comment' && comment.public,
    );

    const userIds = Array.from(new Set(comments.map(comment => comment.author_id)));

    const users = await this.getUsers(userIds);

    return {
      nodes: comments.map(comment => ({
        ...comment,
        fromSupport: users.find(user => user.id === comment.author_id)?.isSupport ?? false,
      })),
      meta: response.meta,
    };
  }

  async createTicket(input: {
    organizationId: string;
    subject: string;
    description: string;
    priority: z.infer<typeof SupportTicketPriorityModel>;
  }) {
    this.logger.info(
      'Creating support ticket (organization: %s, priority: %s, subject: %s)',
      input.organizationId,
      input.subject,
      input.priority,
    );

    const request = SupportTicketCreateRequestModel.safeParse(input);

    if (!request.success) {
      return {
        ok: null,
        error: {
          message: request.error.message,
        },
      };
    }

    await this.authManager.ensureOrganizationAccess({
      organization: input.organizationId,
      scope: OrganizationAccessScope.READ,
    });
    const currentUser = await this.authManager.getCurrentUser();

    const internalOrganizationId = await this.ensureZendeskOrganizationId(input.organizationId);
    const internalUserId = await this.ensureZendeskUserId({
      userId: currentUser.id,
      organizationId: input.organizationId,
    });

    const idempotencyKey = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId: input.organizationId,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
        }),
      )
      .digest('hex');

    const organization = await this.organizationManager.getOrganization({
      organization: input.organizationId,
    });
    const customerType = this.resolveCustomerType(organization);

    const response = await this.httpClient
      .post(`https://${this.config.subdomain}.zendesk.com/api/v2/tickets`, {
        username: this.config.username,
        password: this.config.password,
        json: {
          ticket: {
            organization_id: internalOrganizationId,
            submitter_id: internalUserId,
            requester_id: internalUserId,
            comment: {
              body: request.data.description,
            },
            priority: request.data.priority,
            subject: request.data.subject,
            custom_fields: [{ id: /* Customer Type */ 18185379454865, value: customerType }],
          },
        },
        headers: {
          'idempotency-key': idempotencyKey,
        },
        responseType: 'json',
        context: {
          logger: this.logger,
        },
      })
      .then(res =>
        SupportTicketCreateResponseModel.parseAsync(res).catch(err => {
          this.logger.error(err);
          return Promise.reject(err);
        }),
      );

    return {
      ok: {
        supportTicketId: String(response.ticket.id),
      },
      error: null,
    };
  }

  async replyToTicket(input: { organizationId: string; ticketId: string; body: string }) {
    this.logger.info(
      'Replying to a support ticket (organization: %s, ticket: %s)',
      input.organizationId,
      input.ticketId,
    );

    const request = SupportTicketReplyRequestModel.safeParse(input);

    if (!request.success) {
      return {
        ok: null,
        error: {
          message: request.error.message,
        },
      };
    }

    await this.authManager.ensureOrganizationAccess({
      organization: input.organizationId,
      scope: OrganizationAccessScope.READ,
    });
    const currentUser = await this.authManager.getCurrentUser();
    const internalUserId = await this.ensureZendeskUserId({
      userId: currentUser.id,
      organizationId: input.organizationId,
    });

    const idempotencyKey = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId: input.organizationId,
          ticketId: input.ticketId,
          body: input.body,
          internalUserId,
        }),
      )
      .digest('hex');

    const ticket = await this.getTicket(input.organizationId, input.ticketId);

    if (!ticket) {
      return {
        ok: null,
        error: {
          message: 'Ticket not found',
        },
      };
    }

    const response = await this.httpClient
      .put(`https://${this.config.subdomain}.zendesk.com/api/v2/tickets/${input.ticketId}`, {
        username: this.config.username,
        password: this.config.password,
        json: {
          ticket: {
            comment: {
              body: request.data.body,
              author_id: internalUserId,
              public: true,
            },
          },
        },
        headers: {
          'idempotency-key': idempotencyKey,
        },
        responseType: 'json',
        context: {
          logger: this.logger,
        },
      })
      .then(res =>
        SupportTicketReplyResponseModel.parseAsync(res).catch(err => {
          this.logger.error(err);
          return Promise.reject(err);
        }),
      );

    return {
      ok: {
        supportTicketId: String(response.ticket.id),
      },
      error: null,
    };
  }

  private resolveCustomerType(organization: Organization): string {
    const billingPlanMap: Record<string, string> = {
      ENTERPRISE: 'enterprise_customer',
      PRO: 'pro_customer',
      HOBBY: 'hobby_customer',
    };

    const customerType = billingPlanMap[organization.billingPlan];

    if (customerType) {
      return customerType;
    }

    throw new Error(`Unknown billing plan: ${organization.billingPlan}`);
  }
}
