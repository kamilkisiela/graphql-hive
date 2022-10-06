import { Injectable, Inject, Scope, CONTEXT } from 'graphql-modules';
import type { WebhooksApi } from '@hive/webhooks';
import { createTRPCClient } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import type { CommunicationAdapter, SchemaChangeNotificationInput } from './common';
import { Logger } from '../../../shared/providers/logger';
import { HttpClient } from '../../../shared/providers/http-client';
import { WEBHOOKS_CONFIG } from '../tokens';
import type { WebhooksConfig } from '../tokens';

@Injectable({
  scope: Scope.Operation,
})
export class WebhookCommunicationAdapter implements CommunicationAdapter {
  private logger: Logger;
  private webhooksService;

  constructor(
    logger: Logger,
    private http: HttpClient,
    @Inject(WEBHOOKS_CONFIG) private config: WebhooksConfig,
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext
  ) {
    this.logger = logger.child({ service: 'WebhookCommunicationAdapter' });
    this.webhooksService = createTRPCClient<WebhooksApi>({
      url: `${config.endpoint}/trpc`,
      fetch,
      headers: {
        'x-request-id': context.requestId,
      },
    });
  }

  async sendSchemaChangeNotification(input: SchemaChangeNotificationInput) {
    this.logger.debug(
      `Sending Schema Change Notifications over Webhook (organization=%s, project=%s, target=%s)`,
      input.event.organization.id,
      input.event.project.id,
      input.event.target.id
    );
    try {
      await this.webhooksService.mutation('schedule', {
        endpoint: input.channel.webhookEndpoint!,
        event: input.event,
      });
    } catch (error) {
      this.logger.error(`Failed to send Webhook notification`, error);
    }
  }

  async sendChannelConfirmation() {
    // I don't think we need to implement this for webhooks
  }
}
