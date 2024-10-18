import { IdTranslator } from '../../../shared/providers/id-translator';
import { TokenManager } from '../../providers/token-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteTokens: NonNullable<MutationResolvers['deleteTokens']> = async (
  _parent,
  { input },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const [organizationId, projectId, targetId] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
    translator.translateTargetId(input),
  ]);
  return {
    selector: {
      organizationSlug: input.organizationSlug,
      projectSlug: input.projectSlug,
      targetSlug: input.targetSlug,
    },
    deletedTokens: await injector.get(TokenManager).deleteTokens({
      targetId,
      projectId,
      organizationId,
      tokenIds: input.tokenIds,
    }),
  };
};
