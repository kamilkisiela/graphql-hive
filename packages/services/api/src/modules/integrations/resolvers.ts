import { z } from 'zod';
import { HiveError } from '../../shared/errors';
import { IdTranslator } from '../shared/providers/id-translator';
import type { IntegrationsModule } from './__generated__/types';
import { GitHubIntegrationManager } from './providers/github-integration-manager';
import { SlackIntegrationManager } from './providers/slack-integration-manager';

/**
 * Current token size is 255 characters.
 * We allow some more for being future-proof :)
 *
 * https://api.slack.com/changelog/2016-08-23-token-lengthening
 */
const SlackTokenModel = z.string().min(1).max(1000);

export const resolvers: IntegrationsModule.Resolvers = {
  Mutation: {
    async addSlackIntegration(_, { input }, { injector }) {
      const AddSlackTokenIntegrationModel = z.object({
        token: SlackTokenModel,
      });

      const result = AddSlackTokenIntegrationModel.safeParse(input);

      if (!result.success) {
        throw new HiveError(
          result.error.formErrors.fieldErrors.token?.[0] ?? 'Please check your input.',
        );
      }

      const organization = await injector.get(IdTranslator).translateOrganizationId(input);

      await injector.get(SlackIntegrationManager).register({
        organization,
        token: input.token,
      });

      return true;
    },
    async deleteSlackIntegration(_, { input }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(input);

      await injector.get(SlackIntegrationManager).unregister({
        organization,
      });

      return true;
    },
    async addGitHubIntegration(_, { input }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(input);

      await injector.get(GitHubIntegrationManager).register({
        organization,
        installationId: input.installationId,
      });

      return true;
    },
    async deleteGitHubIntegration(_, { input }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(input);

      await injector.get(GitHubIntegrationManager).unregister({
        organization,
      });

      return true;
    },
  },
  Query: {
    isGitHubIntegrationFeatureEnabled(_, __, { injector }) {
      return injector.get(GitHubIntegrationManager).isEnabled();
    },
    async hasSlackIntegration(_, { selector }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(selector);

      return injector.get(SlackIntegrationManager).isAvailable({
        organization,
      });
    },
    async hasGitHubIntegration(_, { selector }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(selector);

      if (!injector.get(GitHubIntegrationManager).isEnabled()) {
        return false;
      }

      return injector.get(GitHubIntegrationManager).isAvailable({
        organization,
      });
    },
    async gitHubIntegration(_, { selector }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(selector);

      const repositories = await injector.get(GitHubIntegrationManager).getRepositories({
        organization,
      });

      if (repositories == null) {
        return null;
      }

      return {
        repositories,
      };
    },
    organizationByGitHubInstallationId(_, { installation }, { injector }) {
      return injector.get(GitHubIntegrationManager).getOrganization({
        installation,
      });
    },
  },
};
