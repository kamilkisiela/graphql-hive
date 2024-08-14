import { AlertsManager } from '../providers/alerts-manager';
import type { ProjectResolvers } from './../../../__generated__/types.next';

export const Project: Pick<ProjectResolvers, 'alertChannels' | 'alerts' | '__isTypeOf'> = {
  alerts: async (project, _, { injector }) => {
    return injector.get(AlertsManager).getAlerts({
      organization: project.orgId,
      project: project.id,
    });
  },
  alertChannels: async (project, _, { injector }) => {
    return injector.get(AlertsManager).getChannels({
      organization: project.orgId,
      project: project.id,
    });
  },
};
