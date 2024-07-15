import { z } from 'zod';
import { NameModel, ProjectType } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import type { ProjectModule } from './__generated__/types';
import { ProjectManager } from './providers/project-manager';

const ProjectNameModel = NameModel.min(2).max(40);

export const resolvers: ProjectModule.Resolvers & { ProjectType: any } = {
  Mutation: {
    async deleteProject(_, { selector }, { injector }) {
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
    },
    async updateProjectName(_, { input }, { injector }) {
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
    },
  },
  ProjectType: {
    FEDERATION: ProjectType.FEDERATION,
    STITCHING: ProjectType.STITCHING,
    SINGLE: ProjectType.SINGLE,
  },
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
