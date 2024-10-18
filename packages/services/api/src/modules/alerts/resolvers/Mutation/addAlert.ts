import { HiveError } from '../../../../shared/errors';
import { ProjectManager } from '../../../project/providers/project-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { AlertsManager } from '../../providers/alerts-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const addAlert: NonNullable<MutationResolvers['addAlert']> = async (
  _,
  { input },
  { injector },
) => {
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
      organizationId,
      projectId,
      targetId,
      channelId: input.channelId,
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
};
