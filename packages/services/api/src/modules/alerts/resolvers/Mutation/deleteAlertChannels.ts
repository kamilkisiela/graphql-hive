import { HiveError } from '../../../../shared/errors';
import { ProjectManager } from '../../../project/providers/project-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { AlertsManager } from '../../providers/alerts-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteAlertChannels: NonNullable<MutationResolvers['deleteAlertChannels']> = async (
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
};
