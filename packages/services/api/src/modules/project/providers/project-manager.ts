import { Injectable, Scope } from 'graphql-modules';
import { paramCase } from 'param-case';
import type { Project, ProjectType } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { share, uuid } from '../../../shared/helpers';
import { isGitHubRepositoryString } from '../../../shared/is-github-repository-string';
import { ActivityManager } from '../../activity/providers/activity-manager';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { Logger } from '../../shared/providers/logger';
import { OrganizationSelector, ProjectSelector, Storage } from '../../shared/providers/storage';
import { TokenStorage } from '../../token/providers/token-storage';

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
    private tokenStorage: TokenStorage,
    private activityManager: ActivityManager,
  ) {
    this.logger = logger.child({ source: 'ProjectManager' });
  }

  async createProject(
    input: {
      name: string;
      type: ProjectType;
    } & OrganizationSelector,
  ): Promise<Project> {
    const { name, type, organization } = input;
    this.logger.info('Creating a project (input=%o)', input);
    let cleanId = paramCase(name);

    if (
      // packages/web/app uses the "view" prefix, let's avoid the collision
      name.toLowerCase() === 'view' ||
      (await this.storage.getProjectByCleanId({ cleanId, organization }))
    ) {
      cleanId = paramCase(`${name}-${uuid(4)}`);
    }

    // create project
    const project = await this.storage.createProject({
      name,
      cleanId,
      type,
      organization,
    });

    await Promise.all([
      this.storage.completeGetStartedStep({
        organization,
        step: 'creatingProject',
      }),
      this.activityManager.create({
        type: 'PROJECT_CREATED',
        selector: {
          organization,
          project: project.id,
        },
        meta: {
          projectType: type,
        },
      }),
    ]);

    return project;
  }

  async deleteProject({ organization, project }: ProjectSelector): Promise<Project> {
    this.logger.info('Deleting a project (project=%s, organization=%s)', project, organization);
    await this.authManager.ensureProjectAccess({
      project,
      organization,
      scope: ProjectAccessScope.DELETE,
    });

    const deletedProject = await this.storage.deleteProject({
      project,
      organization,
    });

    await this.tokenStorage.invalidateTokens(deletedProject.tokens);

    await this.activityManager.create({
      type: 'PROJECT_DELETED',
      selector: {
        organization,
      },
      meta: {
        name: deletedProject.name,
        cleanId: deletedProject.cleanId,
      },
    });

    return deletedProject;
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
    } & ProjectSelector,
  ): Promise<Project> {
    const { name, organization, project } = input;
    this.logger.info('Updating a project name (input=%o)', input);
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.SETTINGS,
    });
    const user = await this.authManager.getCurrentUser();

    let cleanId = paramCase(name);

    if (await this.storage.getProjectByCleanId({ cleanId, organization })) {
      cleanId = paramCase(`${name}-${uuid(4)}`);
    }

    const result = await this.storage.updateProjectName({
      name,
      organization,
      project,
      user: user.id,
      cleanId,
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
    args: {
      gitRepository?: string | null;
    } & ProjectSelector,
  ): Promise<Project> {
    this.logger.info('Updating a project git repository (input=%o)', args);
    await this.authManager.ensureProjectAccess({
      ...args,
      scope: ProjectAccessScope.SETTINGS,
    });

    const gitRepository = args.gitRepository?.trim() === '' ? null : args.gitRepository ?? null;

    if (gitRepository != null && !isGitHubRepositoryString(gitRepository)) {
      throw new HiveError('Invalid git repository string.');
    }

    return this.storage.updateProjectGitRepository({
      gitRepository,
      organization: args.organization,
      project: args.project,
    });
  }
}
