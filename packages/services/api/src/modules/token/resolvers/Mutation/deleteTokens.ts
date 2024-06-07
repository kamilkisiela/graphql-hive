import { IdTranslator } from '../../../shared/providers/id-translator';
import { TokenManager } from '../../providers/token-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteTokens: NonNullable<MutationResolvers['deleteTokens']> = async (
  _parent,
  { input },
  { injector },
) => {
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
};
