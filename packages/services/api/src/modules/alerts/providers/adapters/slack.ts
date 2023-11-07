import { Inject, Injectable } from 'graphql-modules';
import { Change, CriticalityLevel } from '@graphql-inspector/core';
import { MessageAttachment, WebClient } from '@slack/web-api';
import { Logger } from '../../../shared/providers/logger';
import { WEB_APP_URL } from '../../../shared/providers/tokens';
import {
  ChannelConfirmationInput,
  CommunicationAdapter,
  filterChangesByLevel,
  SchemaChangeNotificationInput,
  slackCoderize,
} from './common';

@Injectable()
export class SlackCommunicationAdapter implements CommunicationAdapter {
  private logger: Logger;

  constructor(
    logger: Logger,
    @Inject(WEB_APP_URL) private appBaseUrl: string,
  ) {
    this.logger = logger.child({ service: 'SlackCommunicationAdapter' });
  }

  private createLink({ text, url }: { text: string; url: string }) {
    return `<${url}|${text}>`;
  }

  async sendSchemaChangeNotification(input: SchemaChangeNotificationInput) {
    this.logger.debug(
      `Sending Schema Change Notifications over Slack (organization=%s, project=%s, target=%s)`,
      input.event.organization.id,
      input.event.project.id,
      input.event.target.id,
    );

    if (!input.integrations.slack.token) {
      this.logger.debug(`Slack Integration is not available`);
      return;
    }

    try {
      const client = new WebClient(input.integrations.slack.token);

      const totalChanges = input.event.changes.length + input.event.messages.length;
      const projectLink = this.createLink({
        text: input.event.project.name,
        url: `${this.appBaseUrl}/${input.event.organization.cleanId}/${input.event.project.cleanId}`,
      });
      const targetLink = this.createLink({
        text: input.event.target.name,
        url: `${this.appBaseUrl}/${input.event.organization.cleanId}/${input.event.project.cleanId}/${input.event.target.cleanId}`,
      });
      const viewLink = this.createLink({
        text: 'view details',
        url: `${this.appBaseUrl}/${input.event.organization.cleanId}/${input.event.project.cleanId}/${input.event.target.cleanId}/history/${input.event.schema.id}`,
      });

      if (input.event.initial) {
        await client.chat.postMessage({
          channel: input.channel.slackChannel!,
          text: `:bee: Hi, I received your *first* schema in project ${projectLink}, target ${targetLink} (${viewLink}):`,
          mrkdwn: true,
          unfurl_links: false,
          unfurl_media: false,
        });
      } else {
        await client.chat.postMessage({
          channel: input.channel.slackChannel!,
          text: `:bee: Hi, I found *${totalChanges} ${this.pluralize(
            'change',
            totalChanges,
          )}* in project ${projectLink}, target ${targetLink} (${viewLink}):`,
          mrkdwn: true,
          attachments: createAttachments(input.event.changes, input.event.messages),
          unfurl_links: false,
          unfurl_media: false,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send Slack notification`, error);
    }
  }

  async sendChannelConfirmation(input: ChannelConfirmationInput) {
    this.logger.debug(
      `Sending Channel Confirmation over Slack (organization=%s, project=%s)`,
      input.event.organization.id,
      input.event.project.id,
    );

    const token = input.integrations.slack.token;

    if (!token) {
      this.logger.debug(`Slack Integration is not available`);
      return;
    }

    const actionMessage =
      input.event.kind === 'created'
        ? `I will send here notifications`
        : `I will no longer send here notifications`;

    try {
      const projectLink = this.createLink({
        text: input.event.project.name,
        url: `${this.appBaseUrl}/${input.event.organization.cleanId}/${input.event.project.cleanId}`,
      });

      const client = new WebClient(token);
      await client.chat.postMessage({
        channel: input.channel.slackChannel!,
        text: [
          `:wave: Hi! I'm the notification :bee:.`,
          `${actionMessage} about your ${projectLink} project.`,
        ].join('\n'),
      });
    } catch (error) {
      this.logger.error(`Failed to send Slack notification`, error);
    }
  }

  private pluralize(word: string, num: number): string {
    return word + (num > 1 ? 's' : '');
  }
}

function createAttachments(changes: readonly Change[], messages: readonly string[]) {
  const breakingChanges = changes.filter(filterChangesByLevel(CriticalityLevel.Breaking));
  const dangerousChanges = changes.filter(filterChangesByLevel(CriticalityLevel.Dangerous));
  const safeChanges = changes.filter(filterChangesByLevel(CriticalityLevel.NonBreaking));

  const attachments: MessageAttachment[] = [];

  if (breakingChanges.length) {
    attachments.push(
      renderAttachments({
        color: '#E74C3B',
        title: 'Breaking changes',
        changes: breakingChanges,
      }),
    );
  }

  if (dangerousChanges.length) {
    attachments.push(
      renderAttachments({
        color: '#F0C418',
        title: 'Dangerous changes',
        changes: dangerousChanges,
      }),
    );
  }

  if (safeChanges.length) {
    attachments.push(
      renderAttachments({
        color: '#23B99A',
        title: 'Safe changes',
        changes: safeChanges,
      }),
    );
  }

  if (messages.length) {
    const text = messages.map(message => slackCoderize(message)).join('\n');
    attachments.push({
      mrkdwn_in: ['text'],
      color: '#1C8DC7',
      author_name: 'Other changes',
      text,
      fallback: text,
    });
  }

  return attachments;
}

function renderAttachments({
  changes,
  title,
  color,
}: {
  color: string;
  title: string;
  changes: readonly Change[];
}): MessageAttachment {
  const text = changes.map(change => slackCoderize(change.message)).join('\n');

  return {
    mrkdwn_in: ['text'],
    color,
    author_name: title,
    text,
    fallback: text,
  };
}
