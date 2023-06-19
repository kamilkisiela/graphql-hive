import { Inject, Injectable, InjectionToken, Scope } from 'graphql-modules';
import { App } from '@octokit/app';
import type { IntegrationsModule } from '../__generated__/types';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { Logger } from '../../shared/providers/logger';
import { OrganizationSelector, Storage } from '../../shared/providers/storage';

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

  async getRepositories(
    selector: OrganizationSelector,
  ): Promise<IntegrationsModule.GitHubIntegration['repositories']> {
    const installationId = await this.getInstallationId(selector);
    this.logger.debug('Fetching repositories');

    if (installationId) {
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

    return [];
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
      throw new Error(
        'GitHub Integration not found. Please install our GraphQL Hive GitHub Application.',
      );
    }

    if (!this.app) {
      throw new Error('GitHub Integration not found. Please provide GITHUB_APP_CONFIG.');
    }

    const octokit = await this.app.getInstallationOctokit(parseInt(installationId, 10));

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

    return result.data.url;
  }
}
