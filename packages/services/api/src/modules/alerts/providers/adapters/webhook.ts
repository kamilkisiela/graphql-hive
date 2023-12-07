import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import type { WebhooksApi } from '@hive/webhooks';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { HttpClient } from '../../../shared/providers/http-client';
import { Logger } from '../../../shared/providers/logger';
import type { WebhooksConfig } from '../tokens';
import { WEBHOOKS_CONFIG } from '../tokens';
import type { CommunicationAdapter, SchemaChangeNotificationInput } from './common';

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
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext,
  ) {
    this.logger = logger.child({ service: 'WebhookCommunicationAdapter' });
    this.webhooksService = createTRPCProxyClient<WebhooksApi>({
      links: [
        httpLink({
          url: `${config.endpoint}/trpc`,
          fetch,
          headers: {
            'x-request-id': context.requestId,
          },
        }),
      ],
    });
  }

  async sendSchemaChangeNotification(input: SchemaChangeNotificationInput) {
    this.logger.debug(
      `Sending Schema Change Notifications over Webhook (organization=%s, project=%s, target=%s)`,
      input.event.organization.id,
      input.event.project.id,
      input.event.target.id,
    );
    try {
      await this.webhooksService.schedule.mutate({
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
