import { IdTranslator } from '../../../shared/providers/id-translator';
import { SchemaManager } from '../../providers/schema-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const enableExternalSchemaComposition: NonNullable<
  MutationResolvers['enableExternalSchemaComposition']
> = async (_, { input }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organization, project] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
  ]);

  return injector.get(SchemaManager).enableExternalSchemaComposition({
    project,
    organization,
    endpoint: input.endpoint,
    secret: input.secret,
  });
};
