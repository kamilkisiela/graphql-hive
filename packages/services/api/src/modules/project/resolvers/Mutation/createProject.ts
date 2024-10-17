import { z } from 'zod';
import { Target } from '../../../../shared/entities';
import { assertOk } from '../../../../shared/helpers';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { Logger } from '../../../shared/providers/logger';
import { TargetManager } from '../../../target/providers/target-manager';
import { ProjectManager } from '../../providers/project-manager';
import { ProjectSlugModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createProject: NonNullable<MutationResolvers['createProject']> = async (
  _,
  { input },
  { injector },
) => {
  const CreateProjectModel = z.object({
    slug: ProjectSlugModel,
  });
  const inputParseResult = CreateProjectModel.safeParse(input);

  if (!inputParseResult.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          slug: inputParseResult.error.formErrors.fieldErrors.slug?.[0],
        },
      },
    };
  }

  const translator = injector.get(IdTranslator);
  const organizationId = await translator.translateOrganizationId({
    organization: input.organization,
  });

  const result = await injector.get(ProjectManager).createProject({
    slug: input.slug,
    type: input.type,
    organization: organizationId,
  });

  if (result.ok === false) {
    return {
      error: {
        message: result.message,
        inputErrors: {},
      },
    };
  }

  assertOk(result, 'Expected result to be ok');

  const organization = await injector.get(OrganizationManager).getOrganization({
    organization: organizationId,
  });

  const targetManager = injector.get(TargetManager);

  const targetResults = await Promise.all([
    targetManager.createTarget({
      slug: 'production',
      project: result.project.id,
      organization: organizationId,
    }),
    targetManager.createTarget({
      slug: 'staging',
      project: result.project.id,
      organization: organizationId,
    }),
    targetManager.createTarget({
      slug: 'development',
      project: result.project.id,
      organization: organizationId,
    }),
  ]);

  const logger = injector.get(Logger);
  const targets: Target[] = [];
  for (const result of targetResults) {
    if (result.ok) {
      targets.push(result.target);
    } else {
      logger.error('Failed to create a target: ' + result.message);
    }
  }

  return {
    ok: {
      createdProject: result.project,
      createdTargets: targets,
      updatedOrganization: organization,
    },
  };
};
