import { ProjectType } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { OrganizationManager } from '../organization/providers/organization-manager';
import type { ProjectModule } from './__generated__/types';
import { ProjectManager } from './providers/project-manager';

export const resolvers: ProjectModule.Resolvers = {
  Organization: {
    projects(organization, _, { injector }) {
      return injector.get(ProjectManager).getProjects({ organization: organization.id });
    },
  },
  Project: {
    async experimental_nativeCompositionPerTarget(project, _, { injector }) {
      if (project.type !== ProjectType.FEDERATION) {
        return false;
      }

      if (!project.nativeFederation) {
        return false;
      }

      const organization = await injector.get(OrganizationManager).getOrganization({
        organization: project.orgId,
      });

      return organization.featureFlags.forceLegacyCompositionInTargets.length > 0;
    },
  },
  ProjectConnection: createConnection(),
};
