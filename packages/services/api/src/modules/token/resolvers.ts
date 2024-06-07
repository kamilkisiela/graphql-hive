import { z } from 'zod';
import { createConnection } from '../../shared/schema';
import { IdTranslator } from '../shared/providers/id-translator';
import type { TokenModule } from './__generated__/types';
import { TokenManager } from './providers/token-manager';

const TokenNameModel = z.string().min(2).max(50);

export const resolvers: TokenModule.Resolvers = {
  Mutation: {
    async createToken(_, { input }, { injector }) {
      const CreateTokenInputModel = z.object({
        name: TokenNameModel,
      });

      const result = CreateTokenInputModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message: result.error.formErrors.fieldErrors.name?.[0] ?? 'Please check your input.',
          },
        };
      }

      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);
      const token = await injector.get(TokenManager).createToken({
        name: input.name,
        target,
        project,
        organization,
        organizationScopes: input.organizationScopes,
        projectScopes: input.projectScopes,
        targetScopes: input.targetScopes,
      });

      return {
        ok: {
          selector: {
            organization: input.organization,
            project: input.project,
            target: input.target,
          },
          createdToken: token,
          secret: token.secret,
        },
      };
    },
    async deleteTokens(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);
      return {
        selector: {
          organization: input.organization,
          project: input.project,
          target: input.target,
        },
        deletedTokens: await injector.get(TokenManager).deleteTokens({
          target,
          project,
          organization,
          tokens: input.tokens,
        }),
      };
    },
  },
  Token: {
    id(token) {
      return token.token;
    },
    alias(token) {
      return token.tokenAlias;
    },
  },
  Target: {
    tokens(target, _, { injector }) {
      return injector.get(TokenManager).getTokens({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
  },
  TokenConnection: createConnection(),
};
