import { FastifyReply } from 'fastify';
import { FastifyRequest } from '@hive/service-common';
import { HiveError } from '../../../shared/errors';
import { isUUID } from '../../../shared/is-uuid';

export type AuthorizationPolicyStatement = {
  effect: 'allow' | 'deny';
  action: string | string[];
  resource: string | string[];
};

/**
 * Parses a Hive Resource identifier into an object
 * e.g. `"hrn:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:target/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"`
 * becomes
 * ```json
 * {
 *   "organizationId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
 *   "resourceType": "target",
 *   "resourceId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
 * }
 * ```
 */
function parseResourceIdentifier(resource: string) {
  const parts = resource.split(':');
  if (parts.length < 2) {
    throw new Error('Invalid resource identifier (1)');
  }
  if (parts[0] !== 'hrn') {
    throw new Error('Invalid resource identifier. Expected string to start with hrn: (2)');
  }

  if (!parts[1] || (!isUUID(parts[1]) && parts[1] !== '*')) {
    throw new Error('Invalid resource identifier. Expected UUID or * (3)');
  }
  const organizationId = parts[1];
  if (!parts[2]) {
    throw new Error('Invalid resource identifier. Expected type or * (4)');
  }

  const resourceParts = parts[2].split('/');
  const resourceType = resourceParts[0];
  const resourceId = resourceParts.at(1) ?? null;

  return { organizationId, resourceType, resourceId };
}

/**
 * Abstract session class that is implemented by various ways to identify a session.
 * A session is a way to identify a user and their permissions for a specific organization.
 *
 * The `Session.loadPolicyStatementsForOrganization` method must be implemented by the subclass.
 */
export abstract class Session {
  /** Load policy statements for a specific organization. */
  protected abstract loadPolicyStatementsForOrganization(
    organizationId: string,
  ): Promise<Array<AuthorizationPolicyStatement>> | Array<AuthorizationPolicyStatement>;

  /**
   * Check whether a session is allowed to perform a specific action.
   * Throws a HiveError if the action is not allowed.
   */
  public async assertPerformAction(args: {
    organizationId: string;
    resourceType: 'target' | 'project' | 'organization';
    resourceId: string | null;
    action: `${string}:${string}`;
  }): Promise<void> {
    const permissions = await this.loadPolicyStatementsForOrganization(args.organizationId);
    const [actionScope] = args.action.split(':');

    let isAllowed = false;

    for (const permission of permissions) {
      const parsedResources = (
        Array.isArray(permission.resource) ? permission.resource : [permission.resource]
      ).map(parseResourceIdentifier);

      let didMatchResource = false;

      // check if resource matches
      for (const resource of parsedResources) {
        // if org is not the same, skip
        if (resource.organizationId !== '*' && resource.organizationId !== args.organizationId) {
          continue;
        }

        // if resource type is not the same, skip
        if (resource.resourceType !== '*' && resource.resourceType !== args.resourceType) {
          continue;
        }

        if (
          args.resourceId &&
          resource.resourceType !== '*' &&
          resource.resourceId !== '*' &&
          args.resourceId !== resource.resourceId
        ) {
          continue;
        }

        didMatchResource = true;
      }

      if (!didMatchResource) {
        continue;
      }

      // check if action matches
      const actions = Array.isArray(permission.action) ? permission.action : [permission.action];
      for (const action of actions) {
        if (
          // any action
          action === '*' ||
          // exact action
          args.action === action ||
          // scope:*
          (actionScope === action.split(':')[0] && action.split(':')[1] === '*')
        ) {
          if (permission.effect === 'deny') {
            throw new HiveError('Permission denied.');
          } else {
            isAllowed = true;
          }
        }
      }
    }

    if (!isAllowed) {
      throw new HiveError('Permission denied.');
    }
  }
}

/** Unauthenticated session that is returned by default. */
class UnauthenticatedSession extends Session {
  protected loadPolicyStatementsForOrganization(
    _: string,
  ): Promise<Array<AuthorizationPolicyStatement>> | Array<AuthorizationPolicyStatement> {
    return [];
  }
}

/**
 * Strategy to authenticate a session from an incoming request.
 * E.g. SuperTokens, JWT, etc.
 */
abstract class AuthNStrategy<TSession extends Session> {
  /**
   * Parse a session from an incoming request.
   * Returns null if the strategy does not apply to the request.
   * Returns a session if the strategy applies to the request.
   * Rejects if the strategy applies to the request but the session could not be parsed.
   */
  public abstract parse(args: {
    req: FastifyRequest;
    reply: FastifyReply;
  }): Promise<TSession | null>;
}

/** Helper class to Authenticate an incoming request. */
export class AuthN {
  private strategies: Array<AuthNStrategy<Session>>;

  constructor(deps: {
    /** List of strategies for authentication a user */
    strategies: Array<AuthNStrategy<Session>>;
  }) {
    this.strategies = deps.strategies;
  }

  /**
   * Returns the first successful `Session` created by a authentication strategy.
   * If no authentication strategy succeeds a `UnauthenticatedSession` is returned instead.
   */
  async authenticate(args: { req: FastifyRequest; reply: FastifyReply }): Promise<Session> {
    for (const strategy of this.strategies) {
      const session = await strategy.parse(args);
      if (session) {
        return session;
      }
    }

    return new UnauthenticatedSession();
  }
}
