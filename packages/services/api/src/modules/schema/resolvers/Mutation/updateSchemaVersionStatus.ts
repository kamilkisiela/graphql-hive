import { IdTranslator } from '../../../shared/providers/id-translator';
import { SchemaPublisher } from '../../providers/schema-publisher';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateSchemaVersionStatus: NonNullable<
  MutationResolvers['updateSchemaVersionStatus']
> = async (_, { input }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organization, project, target] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
    translator.translateTargetId(input),
  ]);

  return injector.get(SchemaPublisher).updateVersionStatus({
    version: input.version,
    valid: input.valid,
    organization,
    project,
    target,
  });
};
