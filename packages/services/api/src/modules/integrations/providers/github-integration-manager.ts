import { Inject, Injectable, InjectionToken, Scope } from 'graphql-modules';
import { App } from '@octokit/app';
import type { Octokit } from '@octokit/core';
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

    return installationId !== null;
  }

  private async getInstallationId(selector: OrganizationSelector): Promise<number | null> {
    this.logger.debug('Fetching GitHub integration token (organization=%s)', selector.organization);

    const rawInstallationId = await this.storage.getGitHubIntegrationInstallationId({
      organization: selector.organization,
    });

    if (!rawInstallationId) {
      this.logger.debug('No installation found. (organization=%s)', selector.organization);

      return null;
    }

    this.logger.debug(
      'GitHub installation found. (organization=%s, installationId=%s)',
      selector.organization,
      rawInstallationId,
    );

    const installationId = parseInt(rawInstallationId, 10);

    if (Number.isNaN(installationId)) {
      this.logger.error(
        "GitHub installation ID can't be parsed. (organization=%s, installationId=%s)",
        selector.organization,
        rawInstallationId,
      );
      throw new Error("GitHub installation ID can't be parsed.");
    }

    return installationId;
  }

  private async getOctokitForOrganization(selector: OrganizationSelector): Promise<Octokit | null> {
    const installationId = await this.getInstallationId(selector);

    if (!installationId) {
      return null;
    }

    if (!this.app) {
      throw new Error('GitHub Integration not found. Please provide GITHUB_APP_CONFIG.');
    }
    return await this.app.getInstallationOctokit(installationId);
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
    this.logger.debug('Fetching repositories');
    const octokit = await this.getOctokitForOrganization(selector);

    if (!octokit) {
      return null;
    }

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
      detailsUrl: string | null;
      output?: {
        /** The title of the check run. */
        title: string;
        /** The summary of the check run. This parameter supports Markdown. */
        summary: string;
      };
    },
  ): Promise<
    | {
        success: true;
        data: GitHubCheckRun;
      }
    | {
        success: false;
        error: string;
      }
  > {
    this.logger.debug(
      'Creating check-run (owner=%s, name=%s, sha=%s)',
      input.repositoryOwner,
      input.repositoryName,
      input.sha,
    );

    const octokit = await this.getOctokitForOrganization(input);

    if (!octokit) {
      throw new HiveError(
        'GitHub Integration not found. Please install our GraphQL Hive GitHub Application.',
      );
    }

    try {
      const result = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
        owner: input.repositoryOwner,
        repo: input.repositoryName,
        name: input.name,
        head_sha: input.sha,
        status: 'in_progress',
        output: input.output,
        details_url: input.detailsUrl ?? undefined,
      });

      this.logger.debug('Check-run created (link=%s)', result.data.url);

      return {
        success: true,
        data: {
          id: result.data.id,
          url: result.data.url,
          repository: input.repositoryName,
          owner: input.repositoryOwner,
          commit: input.sha,
        },
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
          return {
            success: false,
            error: `Commit ${input.sha} not found in repository '${input.repositoryOwner}/${input.repositoryName}'.`,
          };
        }

        return {
          success: false,
          error:
            `Missing permissions for updating check-runs on GitHub repository '${input.repositoryOwner}/${input.repositoryName}'. ` +
            'Please make sure that the GitHub App has access on the repository.',
        };
      }

      throw error;
    }
  }

  async updateCheckRun(args: {
    organizationId: string;
    githubCheckRun: {
      id: number;
      repository: string;
      owner: string;
    };
    conclusion: 'success' | 'failure' | 'neutral';
    output: {
      /** The title of the check run. */
      title: string;
      /** The summary of the check run. This parameter supports Markdown. */
      summary: string;
    };
    detailsUrl: string | null;
  }) {
    this.logger.debug(
      'Update check-run (owner=%s, name=%s, githubCheckRunId=%s)',
      args.githubCheckRun.repository,
      args.githubCheckRun.owner,
      args.githubCheckRun.id,
    );

    const octokit = await this.getOctokitForOrganization({ organization: args.organizationId });

    if (!octokit) {
      throw new HiveError(
        'GitHub Integration not found. Please install our GraphQL Hive GitHub Application.',
      );
    }

    const result = await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
      owner: args.githubCheckRun.owner,
      repo: args.githubCheckRun.repository,
      check_run_id: args.githubCheckRun.id,
      conclusion: args.conclusion,
      output: args.output,
      detailsUrl: args.detailsUrl ?? undefined,
    });

    this.logger.debug('Check-run updated (link=%s)', result.data.url);

    return {
      id: result.data.id,
      url: result.data.url,
    };
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
    const octokit = await this.getOctokitForOrganization({
      organization: args.organizationId,
    });

    if (!octokit) {
      this.logger.warn(
        'Attempting to update GitHub check-run without GitHub App. Please provide GITHUB_APP_CONFIG. Skipping this step. (organizationId=%s, checkRun.owner=%s, checkRun.repository=%s, checkRun.id=%s)',
        args.organizationId,
        args.checkRun.owner,
        args.checkRun.repository,
        args.checkRun.checkRunId,
      );
      return;
    }

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

export type GitHubCheckRun = {
  /** ID of the GitHub check-run */
  id: number;
  /** Owner of the GitHub repository the GitHub check-run is on. */
  owner: string;
  /** GitHub repository the GitHub check-run is on. */
  repository: string;
  /** Commit SHA, with which the GitHub check-run is connected. */
  commit: string;
  /** URL for viewing the check-run on GitHub. */
  url: string;
};
