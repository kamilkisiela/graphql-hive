import { Injectable, Inject } from 'graphql-modules';
import type {
  CommunicationAdapter,
  SchemaChangeNotificationInput,
} from './common';
import { Logger } from '../../../shared/providers/logger';
import { HttpClient } from '../../../shared/providers/http-client';
import { WEBHOOKS_CONFIG } from '../tokens';
import type { WebhooksConfig } from '../tokens';

@Injectable()
export class WebhookCommunicationAdapter implements CommunicationAdapter {
  private logger: Logger;

  constructor(
    logger: Logger,
    private http: HttpClient,
    @Inject(WEBHOOKS_CONFIG) private config: WebhooksConfig
  ) {
    this.logger = logger.child({ service: 'WebhookCommunicationAdapter' });
  }

  async sendSchemaChangeNotification(input: SchemaChangeNotificationInput) {
    this.logger.debug(
      `Sending Schema Change Notifications over Webhook (organization=%s, project=%s, target=%s)`,
      input.event.organization.id,
      input.event.project.id,
      input.event.target.id
    );
    try {
      await this.http.post(this.config.endpoint + '/schedule', {
        headers: {
          'Accept-Encoding': 'gzip, deflate, br',
          'Content-Type': 'application/json',
        },
        retry: { limit: 3 },
        timeout: {
          socket: 1000,
          connect: 1000,
          secureConnect: 1000,
          request: 10_000,
        },
        json: {
          endpoint: input.channel.webhookEndpoint,
          event: input.event,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send Webhook notification`, error);
    }
  }

  async sendChannelConfirmation() {
    // I don't think we need to implement this for webhooks
  }
}
