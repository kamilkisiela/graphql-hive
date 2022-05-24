import type { TokenModule } from './__generated__/types';
import { createConnection } from '../../shared/schema';
import { TokenManager } from './providers/token-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { AuthManager } from '../auth/providers/auth-manager';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { ProjectManager } from '../project/providers/project-manager';
import { TargetManager } from '../target/providers/target-manager';
import { z } from 'zod';

const TokenNameModel = z.string().min(2).max(50);

export const resolvers: TokenModule.Resolvers = {
  Query: {
    async tokens(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(TokenManager).getTokens({
        organization,
        project,
        target,
      });
    },
    async tokenInfo(_, __, { injector }) {
      try {
        injector.get(AuthManager).ensureApiToken();
      } catch (error) {
        return {
          __typename: 'TokenNotFoundError',
          message: (error as Error).message,
        };
      }

      return injector.get(TokenManager).getCurrentToken();
    },
  },
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
  TokenInfo: {
    __isTypeOf(token) {
      return 'token' in token;
    },
    token(token) {
      return token;
    },
    organization(token, _, { injector }) {
      return injector.get(OrganizationManager).getOrganization({
        organization: token.organization,
      });
    },
    project(token, _, { injector }) {
      return injector.get(ProjectManager).getProject({
        organization: token.organization,
        project: token.project,
      });
    },
    target(token, _, { injector }) {
      return injector.get(TargetManager).getTarget({
        organization: token.organization,
        project: token.project,
        target: token.target,
      });
    },
    hasOrganizationScope(token, { scope }) {
      return token.scopes.includes(scope);
    },
    hasProjectScope(token, { scope }) {
      return token.scopes.includes(scope);
    },
    hasTargetScope(token, { scope }) {
      return token.scopes.includes(scope);
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
