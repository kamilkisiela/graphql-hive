import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthN, Session } from '@hive/api/modules/auth/lib/authz';
import { OrganizationAccessTokenSession } from '@hive/api/modules/auth/lib/organization-access-token-strategy';
import { SuperTokensCookieBasedSession } from '@hive/api/modules/auth/lib/supertokens-strategy';
import { TargetAccessTokenSession } from '@hive/api/modules/auth/lib/target-access-token-strategy';

export async function authenticateRequest(
  authN: AuthN,
  context: { req: FastifyRequest; reply: FastifyReply },
): Promise<Session> {
  const session = await authN.authenticate(context);
  const activeSpan = context.req.openTelemetry?.()?.activeSpan;

  if (session instanceof TargetAccessTokenSession) {
    activeSpan?.setAttributes({
      'hive.actor.type': 'targetAccessToken',
      'hive.organization.id': session.organizationId,
      'hive.project.id': session.projectId,
      'hive.target.id': session.targetId,
    });
  } else if (session instanceof SuperTokensCookieBasedSession) {
    activeSpan?.setAttributes({
      'hive.actor.type': 'user',
      'hive.user.id': session.userId ?? '',
    });
  } else if (session instanceof OrganizationAccessTokenSession) {
    const accessToken = session.organizationAccessToken;
    activeSpan?.setAttributes({
      'hive.actor.type': 'organizationAccessToken',
      'hive.access_token.id': accessToken.id,
      'hive.organization.id': accessToken.organizationId,
      ...(accessToken.projectId ? { 'hive.project.id': accessToken.projectId } : {}),
      ...(accessToken.userId ? { 'hive.user.id': accessToken.userId } : {}),
    });
  }

  return session;
}
