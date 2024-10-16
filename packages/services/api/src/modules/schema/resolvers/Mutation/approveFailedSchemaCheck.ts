import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { SchemaManager } from '../../providers/schema-manager';
import { toGraphQLSchemaCheck } from '../../to-graphql-schema-check';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const approveFailedSchemaCheck: NonNullable<
  MutationResolvers['approveFailedSchemaCheck']
> = async (_, { input }, { injector }) => {
  const [organizationId, projectId, targetId] = await Promise.all([
    injector.get(IdTranslator).translateOrganizationId(input),
    injector.get(IdTranslator).translateProjectId(input),
    injector.get(IdTranslator).translateTargetId(input),
  ]);

  const result = await injector.get(SchemaManager).approveFailedSchemaCheck({
    organizationId,
    projectId,
    targetId,
    schemaCheckId: input.schemaCheckId,
    comment: input.comment,
  });

  if (result.type === 'error') {
    return {
      error: {
        message: result.reason,
      },
    };
  }

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  await injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'SCHEMA_CHECKED',
      schemaCheckedAuditLogSchema: {
        checkId: result.schemaCheck.id,
        projectId,
        targetId,
      },
    },
    {
      userId: currentUser.id,
      userEmail: currentUser.email,
      organizationId: organizationId,
      user: currentUser,
    },
  );

  return {
    ok: {
      schemaCheck: toGraphQLSchemaCheck(
        {
          organizationId,
          projectId,
        },
        result.schemaCheck,
      ),
    },
  };
};
