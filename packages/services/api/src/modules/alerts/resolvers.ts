import { TargetManager } from '../target/providers/target-manager';
import type { AlertsModule } from './__generated__/types';
import { AlertsManager } from './providers/alerts-manager';

export const resolvers: AlertsModule.Resolvers = {
  Project: {
    async alerts(project, _, { injector }) {
      return injector.get(AlertsManager).getAlerts({
        organization: project.orgId,
        project: project.id,
      });
    },
    async alertChannels(project, _, { injector }) {
      return injector.get(AlertsManager).getChannels({
        organization: project.orgId,
        project: project.id,
      });
    },
  },
  Alert: {
    async channel(alert, _, { injector }) {
      const channels = await injector.get(AlertsManager).getChannels({
        organization: alert.organizationId,
        project: alert.projectId,
      });

      return channels.find(c => c.id === alert.channelId)!;
    },
    target(alert, _, { injector }) {
      return injector.get(TargetManager).getTarget({
        organization: alert.organizationId,
        project: alert.projectId,
        target: alert.targetId,
      });
    },
  },
  AlertSlackChannel: {
    __isTypeOf(channel) {
      return channel.type === 'SLACK';
    },
    channel(channel) {
      return channel.slackChannel!;
    },
  },
  AlertWebhookChannel: {
    __isTypeOf(channel) {
      return channel.type === 'WEBHOOK';
    },
    endpoint(channel) {
      return channel.webhookEndpoint!;
    },
  },
  TeamsWebhookChannel: {
    __isTypeOf(channel) {
      return channel.type === 'MSTEAMS_WEBHOOK';
    },
    endpoint(channel) {
      return channel.webhookEndpoint!;
    },
  },
};
