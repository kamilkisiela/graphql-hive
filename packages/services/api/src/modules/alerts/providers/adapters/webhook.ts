import { Injectable, Scope } from 'graphql-modules';
import { Logger } from '../../../shared/providers/logger';
import { Transmission } from '../../../shared/providers/transmission';
import type { CommunicationAdapter, SchemaChangeNotificationInput } from './common';

@Injectable({
  scope: Scope.Operation,
})
export class WebhookCommunicationAdapter implements CommunicationAdapter {
  private logger: Logger;

  constructor(
    logger: Logger,
    private transmission: Transmission,
  ) {
    this.logger = logger.child({ service: 'WebhookCommunicationAdapter' });
  }

  async sendSchemaChangeNotification(input: SchemaChangeNotificationInput) {
    this.logger.debug(
      `Sending Schema Change Notifications over Webhook (organization=%s, project=%s, target=%s)`,
      input.event.organization.id,
      input.event.project.id,
      input.event.target.id,
    );
    try {
      await this.transmission.client.webhookTask.mutate({
        payload: {
          url: input.channel.webhookEndpoint!,
          body: JSON.stringify(input.event),
        },
        spec: {
          jobKey: `webhook-schema-change-notification-${input.event.schema.id}`,
          jobKeyMode: 'replace',
          maxAttempts: 5,
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
