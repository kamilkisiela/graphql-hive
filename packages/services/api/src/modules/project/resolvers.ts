import type { ProjectModule } from './__generated__/types';
import { ProjectType } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { ProjectManager } from './providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetManager } from '../target/providers/target-manager';

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
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(selector);
      return injector.get(ProjectManager).getProjects({ organization });
    },
  },
  Mutation: {
    async createProject(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const organization = await translator.translateOrganizationId({
        organization: input.organization,
      });
      const project = await injector.get(ProjectManager).createProject({
        ...input,
        organization,
      });
      const target = await injector.get(TargetManager).createTarget({
        name: 'experiment',
        project: project.id,
        organization,
      });
      return {
        selector: {
          organization: input.organization,
          project: project.cleanId,
        },
        createdProject: project,
        createdTarget: target,
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
        selector: {
          organization: input.organization,
          project: input.project,
        },
        updatedProject: project,
      };
    },
    async updateProjectGitRepository(_, { input }, { injector }) {
      const [organization, project] = await Promise.all([
        injector.get(IdTranslator).translateOrganizationId(input),
        injector.get(IdTranslator).translateProjectId(input),
      ]);

      return {
        selector: {
          organization: input.organization,
          project: input.project,
        },
        updatedProject: await injector.get(ProjectManager).updateGitRepository({
          project,
          organization,
          gitRepository: input.gitRepository,
        }),
      };
    },
  },
  ProjectType: {
    FEDERATION: ProjectType.FEDERATION,
    STITCHING: ProjectType.STITCHING,
    SINGLE: ProjectType.SINGLE,
    CUSTOM: ProjectType.CUSTOM,
  },
  Organization: {
    projects(organization, _, { injector }) {
      return injector
        .get(ProjectManager)
        .getProjects({ organization: organization.id });
    },
  },
  ProjectConnection: createConnection(),
};
