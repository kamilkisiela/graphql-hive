import { IdTranslator } from '../../../shared/providers/id-translator';
import { SchemaManager } from '../../providers/schema-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const testExternalSchemaComposition: NonNullable<
  QueryResolvers['testExternalSchemaComposition']
> = async (_, { selector }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organizationId, projectId] = await Promise.all([
    translator.translateOrganizationId(selector),
    translator.translateProjectId(selector),
  ]);

  const schemaManager = injector.get(SchemaManager);

  const result = await schemaManager.testExternalSchemaComposition({
    organizationId,
    projectId,
  });

  if (result.kind === 'success') {
    return {
      ok: result.project,
    };
  }

  return {
    error: {
      message: result.error,
    },
  };
};
