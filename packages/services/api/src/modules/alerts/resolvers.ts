import { z } from 'zod';
import { HiveError } from '../../shared/errors';
import { ProjectManager } from '../project/providers/project-manager';
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
        webhook: MaybeModel(z.object({ endpoint: z.string().url().max(500) })),
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
      const [organizationId, projectId] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      return {
        ok: {
          updatedProject: injector.get(ProjectManager).getProject({
            organization: organizationId,
            project: projectId,
          }),
          addedAlertChannel: injector.get(AlertsManager).addChannel({
            organization: organizationId,
            project: projectId,
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
      const [organizationId, projectId] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      const project = await injector.get(ProjectManager).getProject({
        organization: organizationId,
        project: projectId,
      });

      try {
        await injector.get(AlertsManager).deleteChannels({
          organization: organizationId,
          project: projectId,
          channels: input.channels,
        });

        return {
          ok: {
            updatedProject: project,
          },
        };
      } catch (error) {
        if (error instanceof HiveError) {
          return {
            error: {
              message: error.message,
            },
          };
        }

        throw error;
      }
    },
    async addAlert(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const project = await injector.get(ProjectManager).getProject({
        organization: organizationId,
        project: projectId,
      });

      try {
        const alert = await injector.get(AlertsManager).addAlert({
          organization: organizationId,
          project: projectId,
          target: targetId,
          channel: input.channel,
          type: input.type,
        });

        return {
          ok: {
            addedAlert: alert,
            updatedProject: project,
          },
        };
      } catch (error) {
        if (error instanceof HiveError) {
          return {
            error: {
              message: error.message,
            },
          };
        }

        throw error;
      }
    },
    async deleteAlerts(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organizationId, projectId] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      const project = await injector.get(ProjectManager).getProject({
        organization: organizationId,
        project: projectId,
      });

      try {
        await injector.get(AlertsManager).deleteAlerts({
          organization: organizationId,
          project: projectId,
          alerts: input.alerts,
        });

        return {
          ok: {
            updatedProject: project,
          },
        };
      } catch (error) {
        if (error instanceof HiveError) {
          return {
            error: {
              message: error.message,
            },
          };
        }

        throw error;
      }
    },
  },
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
};
