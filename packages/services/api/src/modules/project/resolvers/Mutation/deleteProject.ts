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
      organizationSlug: selector.organizationSlug,
    }),
    translator.translateProjectId({
      organizationSlug: selector.organizationSlug,
      projectSlug: selector.projectSlug,
    }),
  ]);
  const deletedProject = await injector.get(ProjectManager).deleteProject({
    organization: organizationId,
    project: projectId,
  });
  return {
    selector: {
      organizationSlug: selector.organizationSlug,
      projectSlug: selector.projectSlug,
    },
    deletedProject,
  };
};
