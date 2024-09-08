import { z } from 'zod';
import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../../target/providers/target-manager';
import { ProjectManager } from '../../providers/project-manager';
import { MaybeModel, ProjectNameModel, URLModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createProject: NonNullable<MutationResolvers['createProject']> = async (
  _,
  { input },
  { injector },
) => {
  const CreateProjectModel = z.object({
    name: ProjectNameModel,
    buildUrl: MaybeModel(URLModel),
    validationUrl: MaybeModel(URLModel),
  });
  const result = CreateProjectModel.safeParse(input);

  if (!result.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          name: result.error.formErrors.fieldErrors.name?.[0],
          buildUrl: result.error.formErrors.fieldErrors.buildUrl?.[0],
          validationUrl: result.error.formErrors.fieldErrors.validationUrl?.[0],
        },
      },
    };
  }

  const translator = injector.get(IdTranslator);
  const organizationId = await translator.translateOrganizationId({
    organization: input.organization,
  });
  const project = await injector.get(ProjectManager).createProject({
    ...input,
    organization: organizationId,
  });
  const organization = await injector.get(OrganizationManager).getOrganization({
    organization: organizationId,
  });

  const targetManager = injector.get(TargetManager);

  const targets = await Promise.all([
    targetManager.createTarget({
      name: 'production',
      project: project.id,
      organization: organizationId,
    }),
    targetManager.createTarget({
      name: 'staging',
      project: project.id,
      organization: organizationId,
    }),
    targetManager.createTarget({
      name: 'development',
      project: project.id,
      organization: organizationId,
    }),
  ]);

  // Audit Log Event
  const currentUser = await injector.get(AuthManager).getCurrentUser();
  await injector.get(AuditLogManager).createLogAuditEvent({
    eventTime: new Date().toISOString(),
    eventType: 'PROJECT_CREATED',
    organizationId: organizationId,
    user: {
      userId: currentUser.id,
      userEmail: currentUser.email,
    },
    ProjectCreatedAuditLogSchema: {
      projectId: project.id,
      projectName: project.name,
    },
  });

  return {
    ok: {
      createdProject: project,
      createdTargets: targets,
      updatedOrganization: organization,
    },
  };
};
