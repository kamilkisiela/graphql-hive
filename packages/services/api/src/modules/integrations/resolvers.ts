import type { IntegrationsModule } from './__generated__/types';
import { SlackIntegrationManager } from './providers/slack-integration-manager';
import { GitHubIntegrationManager } from './providers/github-integration-manager';
import { IdTranslator } from '../shared/providers/id-translator';

export const resolvers: IntegrationsModule.Resolvers = {
  Mutation: {
    async addSlackIntegration(_, { input }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(input);

      await injector.get(SlackIntegrationManager).register({
        organization,
        token: input.token,
      });

      return true;
    },
    async deleteSlackIntegration(_, { input }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(input);

      await injector.get(SlackIntegrationManager).unregister({
        organization,
      });

      return true;
    },
    async addGitHubIntegration(_, { input }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(input);

      await injector.get(GitHubIntegrationManager).register({
        organization,
        installationId: input.installationId,
      });

      return true;
    },
    async deleteGitHubIntegration(_, { input }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(input);

      await injector.get(GitHubIntegrationManager).unregister({
        organization,
      });

      return true;
    },
  },
  Query: {
    async hasSlackIntegration(_, { selector }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(selector);

      return injector.get(SlackIntegrationManager).isAvailable({
        organization,
      });
    },
    async hasGitHubIntegration(_, { selector }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(selector);

      return injector.get(GitHubIntegrationManager).isAvailable({
        organization,
      });
    },
    async gitHubIntegration(_, { selector }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(selector);

      return {
        repositories: await injector
          .get(GitHubIntegrationManager)
          .getRepositories({
            organization,
          }),
      };
    },
    organizationByGitHubInstallationId(_, { installation }, { injector }) {
      return injector.get(GitHubIntegrationManager).getOrganization({
        installation,
      });
    },
  },
};
