import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
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

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'PROJECT_DELETED',
      projectDeletedAuditLogSchema: {
        projectId: projectId,
        projectName: deletedProject.name,
      },
    },
    {
      organizationId: organizationId,
      userEmail: currentUser.email,
      userId: currentUser.id,
      user: currentUser,
    },
  );

  return {
    selector: {
      organization: organizationId,
      project: projectId,
    },
    deletedProject,
  };
};
