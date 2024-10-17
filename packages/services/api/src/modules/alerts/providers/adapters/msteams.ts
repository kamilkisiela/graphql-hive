import { Inject, Injectable } from 'graphql-modules';
import { CriticalityLevel } from '@graphql-inspector/core';
import { SchemaChangeType } from '@hive/storage';
import { Logger } from '../../../shared/providers/logger';
import { WEB_APP_URL } from '../../../shared/providers/tokens';
import {
  ChannelConfirmationInput,
  CommunicationAdapter,
  createMDLink,
  SchemaChangeNotificationInput,
  slackCoderize,
} from './common';

@Injectable()
export class TeamsCommunicationAdapter implements CommunicationAdapter {
  private logger: Logger;

  constructor(
    logger: Logger,
    @Inject(WEB_APP_URL) private appBaseUrl: string,
  ) {
    this.logger = logger.child({ service: 'TeamsCommunicationAdapter' });
  }

  async sendSchemaChangeNotification(input: SchemaChangeNotificationInput) {
    this.logger.debug(
      `Sending Schema Change Notifications over Microsoft Teams (organization=%s, project=%s, target=%s)`,
      input.event.organization.id,
      input.event.project.id,
      input.event.target.id,
    );
    const webhookUrl = input.channel.webhookEndpoint;

    if (!webhookUrl) {
      this.logger.debug(`Microsoft Teams Integration is not available`);
      return;
    }

    try {
      const totalChanges = input.event.changes.length + input.event.messages.length;
      const projectLink = createMDLink({
        text: input.event.project.name,
        url: `${this.appBaseUrl}/${input.event.organization.slug}/${input.event.project.slug}`,
      });
      const targetLink = createMDLink({
        text: input.event.target.name,
        url: `${this.appBaseUrl}/${input.event.organization.slug}/${input.event.project.slug}/${input.event.target.slug}`,
      });
      const changeUrl = `${this.appBaseUrl}/${input.event.organization.slug}/${input.event.project.slug}/${input.event.target.slug}/history/${input.event.schema.id}`;
      const viewLink = createMDLink({
        text: 'view details',
        url: changeUrl,
      });

      const message = input.event.initial
        ? `🐝 Hi, I received your *first* schema in project ${projectLink}, target ${targetLink} (${viewLink}):`
        : `🐝 Hi, I found *${totalChanges} ${this.pluralize(
            'change',
            totalChanges,
          )}* in project ${projectLink}, target ${targetLink} (${viewLink}):`;

      const attachmentsText = input.event.initial
        ? ''
        : createAttachmentsText(input.event.changes, input.event.messages);

      await this.sendTeamsMessage(
        webhookUrl,
        `${message}\n\n${attachmentsText}`,
        createMDLink({
          text: 'view full report',
          url: changeUrl,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to send Microsoft Teams notification`, error);
    }
  }

  async sendChannelConfirmation(input: ChannelConfirmationInput) {
    this.logger.debug(
      `Sending Channel Confirmation over Microsoft Teams (organization=%s, project=%s, channel=%s)`,
      input.event.organization.id,
      input.event.project.id,
    );

    const webhookUrl = input.channel.webhookEndpoint;

    if (!webhookUrl) {
      this.logger.debug(`Microsoft Teams Integration is not available`);
      return;
    }

    const actionMessage =
      input.event.kind === 'created'
        ? `I will send here notifications`
        : `I will no longer send here notifications`;

    try {
      const projectLink = createMDLink({
        text: input.event.project.name,
        url: `${this.appBaseUrl}/${input.event.organization.slug}/${input.event.project.slug}`,
      });

      const message = [
        `👋 Hi! I'm the notification 🐝.`,
        `${actionMessage} about your ${projectLink} project.`,
      ].join('\n');

      await this.sendTeamsMessage(webhookUrl, message);
    } catch (error) {
      this.logger.error(`Failed to send Microsoft Teams notification`, error);
    }
  }

  private pluralize(word: string, num: number): string {
    return word + (num > 1 ? 's' : '');
  }

  /**
   * message gets truncated to max 27k characters-max payload size for Microsoft Teams is 28 KB
   */
  async sendTeamsMessage(webhookUrl: string, message: string, fullReportMdLink?: string) {
    if (message.length > 27000) {
      message = message.slice(0, 27000) + `\n\n... message truncated. ${fullReportMdLink ?? ''}`;
    }

    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: 'Notification',
      themeColor: '0076D7',
      sections: [
        {
          activityTitle: 'Notification',
          text: message,
          markdown: true,
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send Microsoft Teams message: ${response.statusText}`);
    }
  }
}

function createAttachmentsText(
  changes: readonly SchemaChangeType[],
  messages: readonly string[],
): string {
  const breakingChanges = changes.filter(
    change => change.criticality === CriticalityLevel.Breaking,
  );
  const safeChanges = changes.filter(change => change.criticality !== CriticalityLevel.Breaking);

  let text = '';

  if (breakingChanges.length) {
    text += renderChangeList({
      color: '#E74C3B',
      title: 'Breaking changes',
      changes: breakingChanges,
    });
  }

  if (safeChanges.length) {
    text += renderChangeList({
      color: '#23B99A',
      title: 'Safe changes',
      changes: safeChanges,
    });
  }

  if (messages.length) {
    text += `### Other changes\n${messages.map(message => slackCoderize(message)).join('\n')}\n`;
  }

  return text;
}

function renderChangeList({
  changes,
  title,
}: {
  color: string;
  title: string;
  changes: readonly SchemaChangeType[];
}): string {
  const text = changes
    .map(change => {
      let text = ` - ${change.message}`;
      if (change.isSafeBasedOnUsage) {
        text += ' (safe based on usage)';
      }

      return slackCoderize(text);
    })
    .join('\n');

  return `### ${title}\n${text}\n`;
}
