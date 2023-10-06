import { Inject, Injectable, InjectionToken, Scope } from 'graphql-modules';
import { App } from '@octokit/app';
import { RequestError } from '@octokit/request-error';
import type { IntegrationsModule } from '../__generated__/types';
import { HiveError } from '../../../shared/errors';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { ProjectAccessScope } from '../../auth/providers/scopes';
import { Logger } from '../../shared/providers/logger';
import { OrganizationSelector, ProjectSelector, Storage } from '../../shared/providers/storage';

export interface GitHubApplicationConfig {
  appId: number;
  privateKey: string;
}

export const GITHUB_APP_CONFIG = new InjectionToken<GitHubApplicationConfig>(
  'GitHubApplicationConfig',
);

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class GitHubIntegrationManager {
  private logger: Logger;
  private app?: App;

  constructor(
    logger: Logger,
    private authManager: AuthManager,
    private storage: Storage,
    @Inject(GITHUB_APP_CONFIG) private config: GitHubApplicationConfig | null,
  ) {
    this.logger = logger.child({
      source: 'GitHubIntegrationManager',
    });

    if (this.config) {
      this.app = new App({
        appId: this.config.appId,
        privateKey: this.config.privateKey,
        log: this.logger,
      });
    }
  }

  isEnabled(): boolean {
    return !!this.app;
  }

  async register(
    input: OrganizationSelector & {
      installationId: string;
    },
  ): Promise<void> {
    this.logger.debug('Registering GitHub integration (organization=%s)', input.organization);
    await this.authManager.ensureOrganizationAccess({
      ...input,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });
    await this.storage.addGitHubIntegration({
      organization: input.organization,
      installationId: input.installationId,
    });
  }

  async unregister(input: OrganizationSelector): Promise<void> {
    this.logger.debug('Removing GitHub integration (organization=%s)', input.organization);
    await this.authManager.ensureOrganizationAccess({
      ...input,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });
    await this.storage.deleteGitHubIntegration({
      organization: input.organization,
    });
  }

  async isAvailable(selector: OrganizationSelector): Promise<boolean> {
    this.logger.debug('Checking GitHub integration (organization=%s)', selector.organization);

    if (this.isEnabled()) {
      return false;
    }

    const installationId = await this.getInstallationId({
      organization: selector.organization,
    });

    return typeof installationId === 'string';
  }

  async getInstallationId(selector: OrganizationSelector): Promise<string | null | undefined> {
    this.logger.debug('Fetching GitHub integration token (organization=%s)', selector.organization);

    return this.storage.getGitHubIntegrationInstallationId({
      organization: selector.organization,
    });
  }

  /**
   * Fetches repositories for the given organization.
   * Returns null in case no integration is found.
   * @param selector
   * @returns
   */
  async getRepositories(
    selector: OrganizationSelector,
  ): Promise<IntegrationsModule.GitHubIntegration['repositories'] | null> {
    const installationId = await this.getInstallationId(selector);
    this.logger.debug('Fetching repositories');

    if (!installationId) {
      return null;
    }

    if (!this.app) {
      throw new Error('GitHub Integration not found. Please provide GITHUB_APP_CONFIG.');
    }

    const octokit = await this.app.getInstallationOctokit(parseInt(installationId, 10));

    return octokit
      .request('GET /installation/repositories')
      .then(result =>
        result.data.repositories.map(repo => {
          return {
            nameWithOwner: repo.full_name,
          };
        }),
      )
      .catch(e => {
        this.logger.warn('Failed to fetch repositories', e);
        this.logger.error(e);
        return Promise.resolve([]);
      });
  }

  /**
   * Check whether the given organization has access to a given GitHub repository.
   */
  async hasAccessToGitHubRepository(props: {
    selector: OrganizationSelector;
    repositoryName: `${string}/${string}`;
  }): Promise<boolean> {
    const repositories = await this.getRepositories(props.selector);

    if (!repositories) {
      return false;
    }

    return repositories.some(repo => repo.nameWithOwner === props.repositoryName);
  }

  async getOrganization(selector: { installation: string }) {
    const organization = await this.storage.getOrganizationByGitHubInstallationId({
      installationId: selector.installation,
    });

    if (!organization) {
      return null;
    }

    await this.authManager.ensureOrganizationAccess({
      organization: organization.id,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });

    return organization;
  }

  async createCheckRun(
    input: OrganizationSelector & {
      repositoryName: string;
      repositoryOwner: string;
      name: string;
      sha: string;
      conclusion: 'success' | 'neutral' | 'failure';
      detailsUrl: string | null;
      output?: {
        /** The title of the check run. */
        title: string;
        /** The summary of the check run. This parameter supports Markdown. */
        summary: string;
      };
    },
  ) {
    this.logger.debug(
      'Creating check-run (owner=%s, name=%s, sha=%s)',
      input.repositoryOwner,
      input.repositoryName,
      input.sha,
    );
    const installationId = await this.getInstallationId({
      organization: input.organization,
    });

    if (!installationId) {
      throw new HiveError(
        'GitHub Integration not found. Please install our GraphQL Hive GitHub Application.',
      );
    }

    if (!this.app) {
      throw new Error('GitHub Integration not found. Please provide GITHUB_APP_CONFIG.');
    }

    const octokit = await this.app.getInstallationOctokit(parseInt(installationId, 10));

    try {
      const result = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
        owner: input.repositoryOwner,
        repo: input.repositoryName,
        name: input.name,
        head_sha: input.sha,
        conclusion: input.conclusion,
        output: input.output,
        details_url: input.detailsUrl ?? undefined,
      });

      this.logger.debug('Check-run created (link=%s)', result.data.url);

      return {
        id: result.data.id,
        url: result.data.url,
      };
    } catch (error) {
      this.logger.error('Failed to create check-run', error);

      if (isOctokitRequestError(error)) {
        this.logger.debug(
          'GitHub error details (message=%s, status=%s)',
          error.message,
          error.status,
        );

        if (error.message.includes('No commit found for SHA:')) {
          throw new HiveError(
            `Commit ${input.sha} not found in repository ${input.repositoryOwner}/${input.repositoryName}`,
          );
        }
      }

      throw error;
    }
  }

  async updateCheckRunToSuccess(args: {
    organizationId: string;
    checkRun: {
      owner: string;
      repository: string;
      checkRunId: number;
    };
  }) {
    this.logger.debug(
      'Update check-run (organizationId=%s, checkRun.owner=%s, checkRun.repository=%s, checkRun.id=%s)',
      args.organizationId,
      args.checkRun.owner,
      args.checkRun.repository,
      args.checkRun.checkRunId,
    );
    const installationId = await this.getInstallationId({
      organization: args.organizationId,
    });

    if (!this.app || !installationId) {
      this.logger.warn(
        'Attempting to update GitHub check-run without GitHub App. Please provide GITHUB_APP_CONFIG. Skipping this step. (organizationId=%s, checkRun.owner=%s, checkRun.repository=%s, checkRun.id=%s)',
        args.organizationId,
        args.checkRun.owner,
        args.checkRun.repository,
        args.checkRun.checkRunId,
      );
      return;
    }

    const octokit = await this.app.getInstallationOctokit(parseInt(installationId, 10));

    try {
      const result = await octokit.request(
        'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}',
        {
          owner: args.checkRun.owner,
          repo: args.checkRun.repository,
          check_run_id: args.checkRun.checkRunId,
          conclusion: 'success',
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      this.logger.debug('Check-run updated (id=%s, link=%s)', result.data.id, result.data.url);

      return {
        type: 'success',
        id: result.data.id,
        url: result.data.url,
      } as const;
    } catch (error) {
      this.logger.error('Failed to update check-run', error);

      if (isOctokitRequestError(error)) {
        this.logger.debug(
          'GitHub error details (message=%s, status=%s)',
          error.message,
          error.status,
        );
      }

      return {
        type: 'error',
        reason: 'Failed to update check-run on GitHub. Please try again later.',
      };
    }
  }

  async enableProjectNameInGithubCheck(input: ProjectSelector) {
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.SETTINGS,
    });

    const project = await this.storage.getProject(input);

    if (project.useProjectNameInGithubCheck) {
      return project;
    }

    return this.storage.enableProjectNameInGithubCheck(input);
  }
}

function isOctokitRequestError(error: unknown): error is RequestError {
  return error instanceof RequestError;
}
