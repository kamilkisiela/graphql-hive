import { z } from 'zod';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { ProjectManager } from '../../providers/project-manager';
import { ProjectNameModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateProjectName: NonNullable<MutationResolvers['updateProjectName']> = async (
  _,
  { input },
  { injector },
) => {
  const UpdateProjectNameModel = z.object({
    name: ProjectNameModel,
  });

  const result = UpdateProjectNameModel.safeParse(input);

  if (!result.success) {
    return {
      error: {
        message: result.error.formErrors.fieldErrors.name?.[0] ?? 'Please check your input.',
      },
    };
  }

  const translator = injector.get(IdTranslator);
  const [organizationId, projectId] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
  ]);

  const project = await injector.get(ProjectManager).updateName({
    name: input.name,
    organization: organizationId,
    project: projectId,
  });

  return {
    ok: {
      selector: {
        organization: input.organization,
        project: project.cleanId,
      },
      updatedProject: project,
    },
  };
};
