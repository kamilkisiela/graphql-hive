import { IdTranslator } from '../../../shared/providers/id-translator';
import { TokenManager } from '../../providers/token-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const tokens: NonNullable<QueryResolvers['tokens']> = async (
  _parent,
  { selector },
  { injector },
) => {
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
};
