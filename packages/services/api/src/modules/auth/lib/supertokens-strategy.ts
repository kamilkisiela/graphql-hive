import SessionNode from 'supertokens-node/recipe/session/index.js';
import * as zod from 'zod';
import type { FastifyReply, FastifyRequest, ServiceLogger } from '@hive/service-common';
import { captureException } from '@sentry/node';
import { HiveError } from '../../../shared/errors';
import type { Storage } from '../../shared/providers/storage';
import { AuthNStrategy, AuthorizationPolicyStatement, Session } from './authz';
import { transformLegacyPolicies } from './legacy-permissions';

export class SuperTokensCookieBasedSession extends Session {
  public superTokensUserId: string;
  private storage: Storage;

  constructor(args: { superTokensUserId: string; email: string }, deps: { storage: Storage }) {
    super();
    this.superTokensUserId = args.superTokensUserId;
    this.storage = deps.storage;
  }

  protected async loadPolicyStatementsForOrganization(
    organizationId: string,
  ): Promise<Array<AuthorizationPolicyStatement>> {
    const user = await this.storage.getUserBySuperTokenId({
      superTokensUserId: this.superTokensUserId,
    });

    if (!user) {
      return [];
    }

    const member = await this.storage.getOrganizationMember({
      organization: organizationId,
      user: user.id,
    });

    if (Array.isArray(member?.scopes)) {
      return transformLegacyPolicies(organizationId, '*', '*', member.scopes);
    }

    return [];
  }
}

export class SuperTokensUserAuthNStrategy extends AuthNStrategy<SuperTokensCookieBasedSession> {
  private logger: ServiceLogger;
  private storage: Storage;

  constructor(deps: { logger: ServiceLogger; storage: Storage }) {
    super();
    this.logger = deps.logger.child({ module: 'SuperTokensUserAuthNStrategy' });
    this.storage = deps.storage;
  }

  private async verifySuperTokensSession(args: { req: FastifyRequest; reply: FastifyReply }) {
    this.logger.debug('Attempt verifying SuperTokens session');
    let session: SessionNode.SessionContainer | undefined;

    try {
      session = await SessionNode.getSession(args.req, args.reply, {
        sessionRequired: false,
        antiCsrfCheck: false,
        checkDatabase: true,
      });
      this.logger.debug('Session resolution ended successfully');
    } catch (error) {
      if (SessionNode.Error.isErrorFromSuperTokens(error)) {
        // Check whether the email is already verified.
        // If it is not then we need to redirect to the email verification page - which will trigger the email sending.
        if (error.type === SessionNode.Error.INVALID_CLAIMS) {
          throw new HiveError('Your account is not verified. Please verify your email address.', {
            extensions: {
              code: 'VERIFY_EMAIL',
            },
          });
        } else if (
          error.type === SessionNode.Error.TRY_REFRESH_TOKEN ||
          error.type === SessionNode.Error.UNAUTHORISED
        ) {
          throw new HiveError('Invalid session', {
            extensions: {
              code: 'NEEDS_REFRESH',
            },
          });
        }
      }

      this.logger.error(error, 'Error while resolving user');
      captureException(error);

      throw error;
    }

    if (!session) {
      this.logger.debug('No session found');
      return null;
    }

    const payload = session.getAccessTokenPayload();

    if (!payload) {
      this.logger.error('No access token payload found');
      return null;
    }

    const result = SuperTokenAccessTokenModel.safeParse(payload);

    if (result.success === false) {
      this.logger.error('SuperTokens session payload is invalid');
      this.logger.debug('SuperTokens session payload: %s', JSON.stringify(payload));
      this.logger.debug(
        'SuperTokens session parsing errors: %s',
        JSON.stringify(result.error.flatten().fieldErrors),
      );
      throw new HiveError(`Invalid access token provided`);
    }

    this.logger.debug('SuperTokens session resolved.');
    return result.data;
  }

  async parse(args: {
    req: FastifyRequest;
    reply: FastifyReply;
  }): Promise<SuperTokensCookieBasedSession | null> {
    const session = await this.verifySuperTokensSession(args);
    if (!session) {
      return null;
    }

    return new SuperTokensCookieBasedSession(
      {
        superTokensUserId: session.superTokensUserId,
        email: session.email,
      },
      {
        storage: this.storage,
      },
    );
  }
}

const SuperTokenAccessTokenModel = zod.object({
  version: zod.literal('1'),
  superTokensUserId: zod.string(),
  /**
   * Supertokens for some reason omits externalUserId from the access token payload if it is null.
   */
  externalUserId: zod.optional(zod.union([zod.string(), zod.null()])),
  email: zod.string(),
});
