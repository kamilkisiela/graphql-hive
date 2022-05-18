import type { AlertsModule } from './__generated__/types';
import { IdTranslator } from '../shared/providers/id-translator';
import { AlertsManager } from './providers/alerts-manager';
import { TargetManager } from '../target/providers/target-manager';

export const resolvers: AlertsModule.Resolvers = {
  Mutation: {
    async addAlertChannel(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      return injector.get(AlertsManager).addChannel({
        organization,
        project,
        name: input.name,
        type: input.type,
        slack: input.slack,
        webhook: input.webhook,
      });
    },
    async deleteAlertChannels(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      return injector.get(AlertsManager).deleteChannels({
        organization,
        project,
        channels: input.channels,
      });
    },
    async addAlert(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      return injector.get(AlertsManager).addAlert({
        organization,
        project,
        target,
        channel: input.channel,
        type: input.type,
      });
    },
    async deleteAlerts(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      return injector.get(AlertsManager).deleteAlerts({
        organization,
        project,
        alerts: input.alerts,
      });
    },
  },
  Query: {
    async alerts(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
      ]);

      return injector.get(AlertsManager).getAlerts({
        organization,
        project,
      });
    },
    async alertChannels(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
      ]);

      return injector.get(AlertsManager).getChannels({
        organization,
        project,
      });
    },
  },
  Alert: {
    async channel(alert, _, { injector }) {
      const channels = await injector.get(AlertsManager).getChannels({
        organization: alert.organizationId,
        project: alert.projectId,
      });

      return channels.find((c) => c.id === alert.channelId)!;
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
};
