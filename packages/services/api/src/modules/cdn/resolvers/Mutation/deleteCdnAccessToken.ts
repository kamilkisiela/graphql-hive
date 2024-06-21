import { IdTranslator } from '../../../shared/providers/id-translator';
import { CdnProvider } from '../../providers/cdn.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteCdnAccessToken: NonNullable<MutationResolvers['deleteCdnAccessToken']> = async (
  _,
  { input },
  { injector },
) => {
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
};
