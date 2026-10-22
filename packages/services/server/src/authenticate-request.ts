import type { FastifyReply, FastifyRequest } from 'fastify';
import { trace, type Attributes, type Context } from '@graphql-hive/plugin-opentelemetry/api';
import type { AuthN, Session } from '@hive/api/modules/auth/lib/authz';
import { OrganizationAccessTokenSession } from '@hive/api/modules/auth/lib/organization-access-token-strategy';
import { SuperTokensCookieBasedSession } from '@hive/api/modules/auth/lib/supertokens-strategy';
import { TargetAccessTokenSession } from '@hive/api/modules/auth/lib/target-access-token-strategy';

export async function authenticateRequest(
  authN: AuthN,
  context: {
    req: FastifyRequest;
    reply: FastifyReply;
    /** Added to the GraphQL Yoga context by the `useOpenTelemetry` plugin. */
    openTelemetry?: {
      getHttpContext: () => Context | undefined;
    };
  },
): Promise<Session> {
  const session = await authN.authenticate(context);
  const attributes = getActorAttributes(session);

  if (attributes) {
    // Span created by the fastify tracing plugin for the incoming request.
    context.req.openTelemetry?.()?.activeSpan?.setAttributes(attributes);

    // Root HTTP span created by the Yoga OpenTelemetry plugin.
    // Hive Tracing only copies attributes from this span onto the exported operation spans.
    // Note: `hive.getHttpContext` cannot be used here, as it only resolves spans of the first
    // registered plugin instance (we run separate Yoga instances for the internal and public API).
    const httpContext = context.openTelemetry?.getHttpContext();
    const httpSpan = httpContext && trace.getSpan(httpContext);
    httpSpan?.setAttributes(attributes);
  }

  return session;
}

function getActorAttributes(session: Session): Attributes | null {
  if (session instanceof TargetAccessTokenSession) {
    return {
      'hive_console.actor.type': 'targetAccessToken',
      'hive_console.actor.organization_id': session.organizationId,
      'hive_console.actor.project_id': session.projectId,
      'hive_console.actor.target_id': session.targetId,
    };
  }

  if (session instanceof SuperTokensCookieBasedSession) {
    return {
      'hive_console.actor.type': 'user',
      'hive_console.actor.user_id': session.userId ?? '',
    };
  }

  if (session instanceof OrganizationAccessTokenSession) {
    const accessToken = session.organizationAccessToken;
    return {
      'hive_console.actor.type': 'organizationAccessToken',
      'hive_console.actor.access_token_id': accessToken.id,
      'hive_console.actor.organization_id': accessToken.organizationId,
      ...(accessToken.projectId ? { 'hive_console.actor.project_id': accessToken.projectId } : {}),
      ...(accessToken.userId ? { 'hive_console.actor.user_id': accessToken.userId } : {}),
    };
  }

  return null;
}
