import { TargetManager } from '../../target/providers/target-manager';
import { AlertsManager } from '../providers/alerts-manager';
import type { AlertResolvers } from './../../../__generated__/types.next';

export const Alert: AlertResolvers = {
  channel: async (alert, _, { injector }) => {
    const channels = await injector.get(AlertsManager).getChannels({
      organization: alert.organizationId,
      project: alert.projectId,
    });

    return channels.find(c => c.id === alert.channelId)!;
  },
  target: (alert, _, { injector }) => {
    return injector.get(TargetManager).getTarget({
      organization: alert.organizationId,
      project: alert.projectId,
      target: alert.targetId,
    });
  },
};
