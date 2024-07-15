import { HiveError } from '../../shared/errors';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetManager } from '../target/providers/target-manager';
import type { AlertsModule } from './__generated__/types';
import { AlertsManager } from './providers/alerts-manager';

export const resolvers: AlertsModule.Resolvers = {
  Mutation: {
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
  TeamsWebhookChannel: {
    __isTypeOf(channel) {
      return channel.type === 'MSTEAMS_WEBHOOK';
    },
    endpoint(channel) {
      return channel.webhookEndpoint!;
    },
  },
};
