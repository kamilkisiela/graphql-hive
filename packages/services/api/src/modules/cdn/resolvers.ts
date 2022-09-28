import { CdnModule } from './__generated__/types';
import { CdnProvider } from './providers/cdn.provider';
import { IdTranslator } from '../shared/providers/id-translator';
import { AuthManager } from '../auth/providers/auth-manager';
import { TargetAccessScope } from '../auth/providers/target-access';
import { HiveError } from '../../shared/errors';

export const resolvers: CdnModule.Resolvers = {
  Mutation: {
    createCdnToken: async (_, { selector }, { injector }) => {
      const translator = injector.get(IdTranslator);
      const cdn = injector.get(CdnProvider);

      if (cdn.isEnabled() === false) {
        throw new HiveError(`CDN is not configured, cannot generate a token.`);
      }

      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      await injector.get(AuthManager).ensureTargetAccess({
        organization,
        project,
        target,
        scope: TargetAccessScope.REGISTRY_READ,
      });

      return {
        token: cdn.generateToken(target),
        url: cdn.getCdnUrlForTarget(target),
      };
    },
  },
  Query: {
    isCDNEnabled: (_, __, { injector }) => {
      const cdn = injector.get(CdnProvider);

      return cdn.isEnabled();
    },
  },
};
