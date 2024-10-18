import { Injectable, Scope } from 'graphql-modules';
import type { Alert, AlertChannel } from '../../../shared/entities';
import { cache } from '../../../shared/helpers';
import { AuthManager } from '../../auth/providers/auth-manager';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { IntegrationsAccessContext } from '../../integrations/providers/integrations-access-context';
import { SlackIntegrationManager } from '../../integrations/providers/slack-integration-manager';
import { OrganizationManager } from '../../organization/providers/organization-manager';
import { ProjectManager } from '../../project/providers/project-manager';
import { Logger } from '../../shared/providers/logger';
import type { ProjectSelector } from '../../shared/providers/storage';
import { Storage } from '../../shared/providers/storage';
import { ChannelConfirmationInput, SchemaChangeNotificationInput } from './adapters/common';
import { TeamsCommunicationAdapter } from './adapters/msteams';
import { SlackCommunicationAdapter } from './adapters/slack';
import { WebhookCommunicationAdapter } from './adapters/webhook';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AlertsManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private authManager: AuthManager,
    private slackIntegrationManager: SlackIntegrationManager,
    private slack: SlackCommunicationAdapter,
    private webhook: WebhookCommunicationAdapter,
    private teamsWebhook: TeamsCommunicationAdapter,
    private organizationManager: OrganizationManager,
    private projectManager: ProjectManager,
    private storage: Storage,
  ) {
    this.logger = logger.child({ source: 'AlertsManager' });
  }

  async addChannel(input: {
    name: string;
    organizationId: string;
    projectId: string;
    type: AlertChannel['type'];
    slackChannel?: string | null;
    webhookEndpoint?: string | null;
  }): Promise<AlertChannel> {
    this.logger.debug(
      'Adding Alert Channel (organization=%s, project=%s, type=%s)',
      input.organizationId,
      input.projectId,
      input.type,
    );
    await this.authManager.ensureProjectAccess({
      scope: ProjectAccessScope.ALERTS,
      organization: input.organizationId,
      project: input.projectId,
    });

    const channel = await this.storage.addAlertChannel({
      slackChannel: input.slackChannel,
      webhookEndpoint: input.webhookEndpoint,
      name: input.name,
      type: input.type,
      organizationId: input.organizationId,
      projectId: input.projectId,
    });

    await this.triggerChannelConfirmation({
      kind: 'created',
      channel,
      organization: input.organizationId,
      project: input.projectId,
    });

    return channel;
  }

  async deleteChannels(input: {
    channelIds: readonly string[];
    organizationId: string;
    projectId: string;
  }): Promise<readonly AlertChannel[]> {
    this.logger.debug(
      'Deleting Alert Channels (organization=%s, project=%s, size=%s)',
      input.organizationId,
      input.projectId,
      input.channelIds.length,
    );
    await this.authManager.ensureProjectAccess({
      scope: ProjectAccessScope.ALERTS,
      organization: input.organizationId,
      project: input.projectId,
    });
    const channels = await this.storage.deleteAlertChannels({
      organizationId: input.organizationId,
      projectId: input.projectId,
      channelIds: input.channelIds,
    });

    await Promise.all(
      channels.map(channel =>
        this.triggerChannelConfirmation({
          kind: 'deleted',
          channel,
          organization: input.organizationId,
          project: input.projectId,
        }),
      ),
    );

    return channels;
  }

  @cache<ProjectSelector>(selector => selector.project + selector.organization)
  async getChannels(selector: ProjectSelector): Promise<readonly AlertChannel[]> {
    this.logger.debug(
      'Fetching Alert Channels (organization=%s, project=%s)',
      selector.organization,
      selector.project,
    );
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.READ,
    });
    return this.storage.getAlertChannels(selector);
  }

  async addAlert(input: {
    type: Alert['type'];
    organizationId: string;
    projectId: string;
    targetId: string;
    channelId: string;
  }): Promise<Alert> {
    this.logger.debug(
      'Adding Alert (organization=%s, project=%s, type=%s)',
      input.organizationId,
      input.projectId,
      input.type,
    );
    await this.authManager.ensureProjectAccess({
      scope: ProjectAccessScope.ALERTS,
      organization: input.organizationId,
      project: input.projectId,
    });

    return this.storage.addAlert({
      type: input.type,
      channelId: input.channelId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      targetId: input.targetId,
    });
  }

  async deleteAlerts(
    input: ProjectSelector & {
      alerts: readonly string[];
    },
  ): Promise<readonly Alert[]> {
    this.logger.debug(
      'Deleting Alerts (organization=%s, project=%s, size=%s)',
      input.organization,
      input.project,
      input.alerts.length,
    );
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.ALERTS,
    });
    return this.storage.deleteAlerts(input);
  }

  async getAlerts(selector: ProjectSelector): Promise<readonly Alert[]> {
    this.logger.debug(
      'Fetching Alerts (organization=%s, project=%s)',
      selector.organization,
      selector.project,
    );
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.READ,
    });
    return this.storage.getAlerts(selector);
  }

  async triggerSchemaChangeNotifications(
    // Omitting cleanId fields from the event object.
    // The cleanId is in the type for backwards compatibility,
    // but we replaced it with slug.
    // Ugly, but otherwise we would have to write a new type,
    // specific for this parameter.
    event: Omit<SchemaChangeNotificationInput['event'], 'organization' | 'project' | 'target'> & {
      organization: Omit<SchemaChangeNotificationInput['event']['organization'], 'cleanId'>;
      project: Omit<SchemaChangeNotificationInput['event']['project'], 'cleanId'>;
      target: Omit<SchemaChangeNotificationInput['event']['target'], 'cleanId'>;
    },
  ) {
    const organization = event.organization.id;
    const project = event.project.id;
    const target = event.target.id;

    this.logger.debug(
      'Triggering Schema Change Notifications (organization=%s, project=%s, target=%s, version=%s)',
      organization,
      project,
      target,
      event.schema.id,
    );

    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });

    const [channels, alerts] = await Promise.all([
      this.getChannels({ organization, project }),
      this.getAlerts({ organization, project }),
    ]);

    const matchingAlerts = alerts.filter(
      alert => alert.type === 'SCHEMA_CHANGE_NOTIFICATIONS' && alert.targetId === target,
    );
    const pairs = matchingAlerts.map(alert => {
      return {
        alert,
        channel: channels.find(channel => channel.id === alert.channelId)!,
      };
    });

    const slackToken = await this.slackIntegrationManager.getToken({
      organization: event.organization.id,
      project: event.project.id,
      target: event.target.id,
      context: IntegrationsAccessContext.SchemaPublishing,
    });

    const integrations: SchemaChangeNotificationInput['integrations'] = {
      slack: {
        token: slackToken,
      },
      // ms Teams is integrated via webhook. Webhook contains the token in itself, so we don't have any other token for it
    };

    // Let's not leak any data :)
    const safeEvent: SchemaChangeNotificationInput['event'] = {
      organization: {
        id: event.organization.id,
        cleanId: event.organization.slug,
        slug: event.organization.slug,
        name: event.organization.name,
      },
      project: {
        id: event.project.id,
        cleanId: event.project.slug,
        slug: event.project.slug,
        name: event.project.name,
      },
      target: {
        id: event.target.id,
        cleanId: event.target.slug,
        slug: event.target.slug,
        name: event.target.name,
      },
      schema: {
        id: event.schema.id,
        commit: event.schema.commit,
        valid: event.schema.valid,
      },
      changes: event.changes,
      messages: event.messages,
      errors: event.errors,
      initial: event.initial,
    };

    await Promise.all(
      pairs.map(({ channel, alert }) => {
        if (channel.type === 'SLACK') {
          return this.slack.sendSchemaChangeNotification({
            event: safeEvent,
            alert,
            channel,
            integrations,
          });
        }
        if (channel.type === 'MSTEAMS_WEBHOOK') {
          return this.teamsWebhook.sendSchemaChangeNotification({
            event: safeEvent,
            alert,
            channel,
            integrations,
          });
        }

        return this.webhook.sendSchemaChangeNotification({
          event: safeEvent,
          alert,
          channel,
          integrations,
        });
      }),
    );
  }

  async triggerChannelConfirmation(input: {
    kind: 'created' | 'deleted';
    channel: AlertChannel;
    organization: string;
    project: string;
  }): Promise<void> {
    const { channel } = input;
    const [organization, project] = await Promise.all([
      this.organizationManager.getOrganization({
        organization: input.organization,
      }),
      this.projectManager.getProject({
        organization: input.organization,
        project: input.project,
      }),
    ]);

    const channelConfirmationContext: ChannelConfirmationInput = {
      event: {
        kind: input.kind,
        organization: {
          id: organization.id,
          cleanId: organization.slug,
          slug: organization.slug,
          name: organization.name,
        },
        project: {
          id: project.id,
          cleanId: project.slug,
          slug: project.slug,
          name: project.name,
        },
      },
      channel,
      integrations: {
        slack: {
          token: null,
        },
      },
    };

    if (channel.type === 'SLACK') {
      const slackToken = await this.slackIntegrationManager.getToken({
        organization: organization.id,
        project: project.id,
        context: IntegrationsAccessContext.ChannelConfirmation,
      });
      if (!slackToken) {
        throw new Error(`Slack token was not found for channel "${channel.id}"`);
      }

      channelConfirmationContext.integrations.slack.token = slackToken;
      await this.slack.sendChannelConfirmation(channelConfirmationContext);
    } else if (channel.type === 'MSTEAMS_WEBHOOK') {
      await this.teamsWebhook.sendChannelConfirmation(channelConfirmationContext);
    } else {
      await this.webhook.sendChannelConfirmation();
    }
  }
}
