import { ProjectManager } from '../providers/project-manager';
import type { OrganizationResolvers } from './../../../__generated__/types.next';

export const Organization: Pick<OrganizationResolvers, 'projects' | '__isTypeOf'> = {
  projects: (organization, _, { injector }) => {
    return injector.get(ProjectManager).getProjects({ organization: organization.id });
  },
};
