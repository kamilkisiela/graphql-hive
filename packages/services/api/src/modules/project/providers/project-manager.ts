import { Injectable, Scope } from 'graphql-modules';
import { paramCase } from 'param-case';
import type { Project, ProjectType } from '../../../shared/entities';
import { AuthManager } from '../../auth/providers/auth-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage, OrganizationSelector, ProjectSelector } from '../../shared/providers/storage';
import { NullableAndPartial, share, uuid } from '../../../shared/helpers';
import { SchemaManager } from '../../schema/providers/schema-manager';
import type { CustomOrchestratorConfig } from '../../schema/providers/orchestrators/custom';
import { ActivityManager } from '../../activity/providers/activity-manager';
import { TokenStorage } from '../../token/providers/token-storage';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { ProjectAccessScope } from '../../auth/providers/project-access';

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ProjectManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
    private authManager: AuthManager,
    private schemaManager: SchemaManager,
    private tokenStorage: TokenStorage,
    private activityManager: ActivityManager
  ) {
    this.logger = logger.child({ source: 'ProjectManager' });
  }

  async createProject(
    input: {
      name: string;
      type: ProjectType;
    } & OrganizationSelector &
      NullableAndPartial<CustomOrchestratorConfig>
  ): Promise<Project> {
    const { name, type, organization, buildUrl, validationUrl } = input;
    this.logger.info('Creating a project (input=%o)', input);
    let cleanId = paramCase(name);

    if (await this.storage.getProjectByCleanId({ cleanId, organization })) {
      cleanId = paramCase(`${name}-${uuid(4)}`);
    }

    const orchestrator = this.schemaManager.matchOrchestrator(type);

    orchestrator.ensureConfig({ buildUrl, validationUrl });

    // create project
    const project = await this.storage.createProject({
      name,
      cleanId,
      type,
      organization,
      buildUrl,
      validationUrl,
    });

    await this.activityManager.create({
      type: 'PROJECT_CREATED',
      selector: {
        organization,
        project: project.id,
      },
      meta: {
        projectType: type,
      },
    });

    return project;
  }

  async deleteProject({ organization, project }: ProjectSelector): Promise<Project> {
    this.logger.info('Deleting a project (project=%s, organization=%s)', project, organization);
    await this.authManager.ensureProjectAccess({
      project,
      organization,
      scope: ProjectAccessScope.DELETE,
    });

    const [result] = await Promise.all([
      this.storage.deleteProject({
        project,
        organization,
      }),
      this.tokenStorage.invalidateProject({
        project,
        organization,
      }),
    ]);

    await this.activityManager.create({
      type: 'PROJECT_DELETED',
      selector: {
        organization,
      },
      meta: {
        name: result.name,
        cleanId: result.cleanId,
      },
    });

    return result;
  }

  getProjectIdByToken: () => Promise<string | never> = share(async () => {
    const token = this.authManager.ensureApiToken();
    const { project } = await this.tokenStorage.getToken({ token });

    return project;
  });

  async getProject(selector: ProjectSelector): Promise<Project> {
    this.logger.debug('Fetching project (selector=%o)', selector);
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.READ,
    });
    return this.storage.getProject(selector);
  }

  async getProjects(selector: OrganizationSelector): Promise<Project[]> {
    this.logger.debug('Fetching projects (selector=%o)', selector);
    await this.authManager.ensureOrganizationAccess({
      ...selector,
      scope: OrganizationAccessScope.READ,
    });
    return this.storage.getProjects(selector);
  }

  async updateName(
    input: {
      name: string;
    } & ProjectSelector
  ): Promise<Project> {
    const { name, organization, project } = input;
    this.logger.info('Updating a project name (input=%o)', input);
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.SETTINGS,
    });
    const user = await this.authManager.getCurrentUser();

    const result = await this.storage.updateProjectName({
      name,
      organization,
      project,
      user: user.id,
    });

    await this.activityManager.create({
      type: 'PROJECT_NAME_UPDATED',
      selector: {
        organization,
        project,
      },
      meta: {
        value: name,
      },
    });

    return result;
  }

  async updateGitRepository(
    input: {
      gitRepository?: string | null;
    } & ProjectSelector
  ): Promise<Project> {
    const { gitRepository, organization, project } = input;
    this.logger.info('Updating a project git repository (input=%o)', input);
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.SETTINGS,
    });

    return this.storage.updateProjectGitRepository({
      gitRepository: gitRepository?.trim() === '' ? null : gitRepository,
      organization,
      project,
    });
  }
}
