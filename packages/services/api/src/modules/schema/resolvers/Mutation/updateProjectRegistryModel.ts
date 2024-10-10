import { IdTranslator } from '../../../shared/providers/id-translator';
import { SchemaManager } from '../../providers/schema-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateProjectRegistryModel: NonNullable<
  MutationResolvers['updateProjectRegistryModel']
> = async (_, { input }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organization, project] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
  ]);

  return {
    ok: await injector.get(SchemaManager).updateRegistryModel({
      project,
      organization,
      model: input.model,
    }),
  };
};
