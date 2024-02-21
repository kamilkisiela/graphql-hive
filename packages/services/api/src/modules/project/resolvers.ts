import { z } from 'zod';
import { NameModel, ProjectType } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetManager } from '../target/providers/target-manager';
import type { ProjectModule } from './__generated__/types';
import { ProjectManager } from './providers/project-manager';

const ProjectNameModel = NameModel.min(2).max(40);
const URLModel = z.string().url().max(500);
const MaybeModel = <T extends z.ZodType>(value: T) => z.union([z.null(), z.undefined(), value]);

export const resolvers: ProjectModule.Resolvers & { ProjectType: any } = {
  Query: {
    async project(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
      ]);
      return injector.get(ProjectManager).getProject({
        project,
        organization,
      });
    },
    async projects(_, { selector }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(selector);
      return injector.get(ProjectManager).getProjects({ organization });
    },
  },
  Mutation: {
    async createProject(_, { input }, { injector }) {
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

      return {
        ok: {
          createdProject: project,
          createdTargets: targets,
          updatedOrganization: organization,
        },
      };
    },
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
  ProjectConnection: createConnection(),
};
