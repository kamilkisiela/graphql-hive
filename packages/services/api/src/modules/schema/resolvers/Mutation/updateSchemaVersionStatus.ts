import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
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

  const result = injector.get(SchemaPublisher).updateVersionStatus({
    version: input.version,
    valid: input.valid,
    organization,
    project,
    target,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  await injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'SCHEMA_POLICY_SETTINGS_UPDATED',
      schemaPolicySettingsUpdatedAuditLogSchema: {
        projectId: project,
        updatedFields: JSON.stringify({
          versionStatus: input.valid,
          version: input.version,
          result: result,
        }),
      },
    },
    {
      userId: currentUser.id,
      userEmail: currentUser.email,
      organizationId: organization,
      user: currentUser,
    },
  );

  return result;
};
