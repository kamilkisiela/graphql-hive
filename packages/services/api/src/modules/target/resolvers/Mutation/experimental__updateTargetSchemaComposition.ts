import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const experimental__updateTargetSchemaComposition: NonNullable<
  MutationResolvers['experimental__updateTargetSchemaComposition']
> = async (_, { input }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organizationId, projectId, targetId] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
    translator.translateTargetId(input),
  ]);

  return injector.get(TargetManager).updateTargetSchemaComposition({
    organizationId,
    projectId,
    targetId,
    nativeComposition: input.nativeComposition,
  });
};
