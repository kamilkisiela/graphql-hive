import { z } from 'zod';
import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../../target/providers/target-manager';
import { SchemaManager } from '../../providers/schema-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

const MaybeModel = <T extends z.ZodType>(value: T) => z.union([z.null(), z.undefined(), value]);
const GraphQLSchemaStringModel = z.string().max(5_000_000).min(0);

export const updateBaseSchema: NonNullable<MutationResolvers['updateBaseSchema']> = async (
  _,
  { input },
  { injector },
) => {
  const UpdateBaseSchemaModel = z.object({
    newBase: MaybeModel(GraphQLSchemaStringModel),
  });

  const result = UpdateBaseSchemaModel.safeParse(input);

  if (!result.success) {
    return {
      error: {
        message: result.error.formErrors.fieldErrors?.newBase?.[0] ?? 'Please check your input.',
      },
    };
  }

  const schemaManager = injector.get(SchemaManager);
  const translator = injector.get(IdTranslator);
  const [organization, project, target] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
    translator.translateTargetId(input),
  ]);

  const selector = { organization, project, target };
  await schemaManager.updateBaseSchema(selector, input.newBase ? input.newBase : null);

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  await injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'SCHEMA_POLICY_SETTINGS_UPDATED',
      schemaPolicySettingsUpdatedAuditLogSchema: {
        projectId: project,
        updatedFields: JSON.stringify({
          baseSchema: input.newBase ? 'updated' : 'removed',
          newBase: input.newBase,
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

  return {
    ok: {
      updatedTarget: await injector.get(TargetManager).getTarget({
        organization,
        target,
        project,
      }),
    },
  };
};
