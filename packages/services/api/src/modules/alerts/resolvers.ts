import { z } from 'zod';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetManager } from '../target/providers/target-manager';
import type { AlertsModule } from './__generated__/types';
import { AlertsManager } from './providers/alerts-manager';

const AlertChannelNameModel = z.string().min(1).max(100);
const SlackChannelNameModel = z.string().min(1).max(80);
const MaybeModel = <T extends z.ZodType>(value: T) => z.union([z.null(), z.undefined(), value]);

export const resolvers: AlertsModule.Resolvers = {
  Mutation: {
    async addAlertChannel(_, { input }, { injector }) {
      const AddAlertChannelModel = z.object({
        slack: MaybeModel(z.object({ channel: SlackChannelNameModel })),
        webhook: MaybeModel(z.object({ endpoint: z.string().url() })),
        name: AlertChannelNameModel,
      });

      const result = AddAlertChannelModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message: 'Please check your input.',
            inputErrors: {
              slackChannel: result.error.formErrors.fieldErrors.slack?.[0],
              webhookEndpoint: result.error.formErrors.fieldErrors.webhook?.[0],
              name: result.error.formErrors.fieldErrors.name?.[0],
            },
          },
        };
      }

      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      return {
        ok: {
          addedAlertChannel: injector.get(AlertsManager).addChannel({
            organization,
            project,
            name: input.name,
            type: input.type,
            slack: input.slack,
            webhook: input.webhook,
          }),
        },
      };
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
};
