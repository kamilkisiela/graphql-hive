import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { ProjectManager } from '../../../project/providers/project-manager';
import { TargetManager } from '../../../target/providers/target-manager';
import { SchemaPublisher } from '../../providers/schema-publisher';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const schemaPublish: NonNullable<MutationResolvers['schemaPublish']> = async (
  _,
  { input },
  { injector, request },
  info,
) => {
  const [organization, project, target] = await Promise.all([
    injector.get(OrganizationManager).getOrganizationIdByToken(),
    injector.get(ProjectManager).getProjectIdByToken(),
    injector.get(TargetManager).getTargetIdByToken(),
  ]);

  // We only want to resolve to SchemaPublishMissingUrlError if it is selected by the operation.
  // NOTE: This should be removed once the usage of cli versions that don't request on 'SchemaPublishMissingUrlError' is becomes pretty low.
  const parsedResolveInfoFragment = parseResolveInfo(info);
  const isSchemaPublishMissingUrlErrorSelected =
    !!parsedResolveInfoFragment?.fieldsByTypeName['SchemaPublishMissingUrlError'];

  const result = await injector.get(SchemaPublisher).publish(
    {
      ...input,
      service: input.service?.toLowerCase(),
      organization,
      project,
      target,
      isSchemaPublishMissingUrlErrorSelected,
    },
    request.signal,
  );

  if ('changes' in result) {
    return {
      ...result,
      changes: result.changes,
    };
  }

  return result;
};
