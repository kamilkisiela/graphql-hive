import { HiveError } from '../../../../shared/errors';
import { ProjectManager } from '../../../project/providers/project-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { AlertsManager } from '../../providers/alerts-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteAlerts: NonNullable<MutationResolvers['deleteAlerts']> = async (
  _,
  { input },
  { injector },
) => {
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
      alerts: input.alertIds,
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
};
