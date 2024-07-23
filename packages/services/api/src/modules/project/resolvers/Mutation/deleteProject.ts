import { IdTranslator } from '../../../shared/providers/id-translator';
import { ProjectManager } from '../../providers/project-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteProject: NonNullable<MutationResolvers['deleteProject']> = async (
  _,
  { selector },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const [organizationId, projectId] = await Promise.all([
    translator.translateOrganizationId({
      organization: selector.organization,
    }),
    translator.translateProjectId({
      organization: selector.organization,
      project: selector.project,
    }),
  ]);
  const deletedProject = await injector.get(ProjectManager).deleteProject({
    organization: organizationId,
    project: projectId,
  });
  return {
    selector: {
      organization: organizationId,
      project: projectId,
    },
    deletedProject,
  };
};
