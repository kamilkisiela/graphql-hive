import { HiveError } from '../../shared/errors';
import { IdTranslator } from '../shared/providers/id-translator';
import { CdnModule } from './__generated__/types';
import { CdnProvider } from './providers/cdn.provider';

export const resolvers: CdnModule.Resolvers = {
  Mutation: {
    createCdnAccessToken: async (_, { input }, { injector }) => {
      const translator = injector.get(IdTranslator);
      const cdn = injector.get(CdnProvider);

      if (cdn.isEnabled() === false) {
        throw new HiveError(`CDN is not configured, cannot generate a token.`);
      }

      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(input.selector),
        translator.translateProjectId(input.selector),
        translator.translateTargetId(input.selector),
      ]);

      const result = await cdn.createCDNAccessToken({
        organizationId,
        projectId,
        targetId,
        alias: input.alias,
      });

      if (result.type === 'failure') {
        return {
          error: {
            message: result.reason,
          },
        };
      }

      return {
        ok: {
          secretAccessToken: result.secretAccessToken,
          createdCdnAccessToken: result.cdnAccessToken,
          cdnUrl: cdn.getCdnUrlForTarget(targetId),
        },
      };
    },
    deleteCdnAccessToken: async (_, { input }, { injector }) => {
      const translator = injector.get(IdTranslator);

      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(input.selector),
        translator.translateProjectId(input.selector),
        translator.translateTargetId(input.selector),
      ]);

      const deleteResult = await injector.get(CdnProvider).deleteCDNAccessToken({
        organizationId,
        projectId,
        targetId,
        cdnAccessTokenId: input.cdnAccessTokenId,
      });

      if (deleteResult.type === 'failure') {
        return {
          error: {
            message: deleteResult.reason,
          },
        };
      }

      return {
        ok: {
          deletedCdnAccessTokenId: input.cdnAccessTokenId,
        },
      };
    },
  },
  Query: {
    isCDNEnabled: (_, __, { injector }) => {
      const cdn = injector.get(CdnProvider);

      return cdn.isEnabled();
    },
  },
  Target: {
    async cdnAccessTokens(target, args, context) {
      const result = await context.injector.get(CdnProvider).getPaginatedCDNAccessTokensForTarget({
        targetId: target.id,
        projectId: target.projectId,
        organizationId: target.orgId,
        first: args.first ?? null,
        cursor: args.after ?? null,
      });

      return {
        edges: result.items,
        pageInfo: result.pageInfo,
      };
    },
    cdnUrl(target, _args, context) {
      return context.injector.get(CdnProvider).getCdnUrlForTarget(target.id);
    },
  },
  Contract: {
    cdnUrl(contract, _, context) {
      return context.injector.get(CdnProvider).getCdnUrlForContract(contract);
    },
  },
};
