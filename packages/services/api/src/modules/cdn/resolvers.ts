import { HiveError } from '../../shared/errors';
import { IdTranslator } from '../shared/providers/id-translator';
import { CdnModule } from './__generated__/types';
import { CdnProvider } from './providers/cdn.provider';

export const resolvers: CdnModule.Resolvers = {
  Mutation: {
    createCdnToken: async (_, { selector }, { injector }) => {
      const translator = injector.get(IdTranslator);
      const cdn = injector.get(CdnProvider);

      if (cdn.isEnabled() === false) {
        throw new HiveError(`CDN is not configured, cannot generate a token.`);
      }

      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return await cdn.generateCdnAccess({
        organizationId,
        projectId,
        targetId,
      });
    },
  },
  Query: {
    isCDNEnabled: (_, __, { injector }) => {
      const cdn = injector.get(CdnProvider);

      return cdn.isEnabled();
    },
  },
};
