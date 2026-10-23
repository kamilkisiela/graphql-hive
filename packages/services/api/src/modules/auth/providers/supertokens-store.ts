import z from 'zod';
import { PostgresDatabasePool, psql, type CommonQueryMethods } from '@hive/postgres';
import { Logger } from '../../shared/providers/logger';

const SessionInfoModel = z.object({
  sessionHandle: z.string(),
  userId: z.string(),
  sessionData: z.string(),
  expiresAt: z.number(),
  createdAt: z.number(),
  refreshTokenHash2: z.string(),
});

export type SessionInfo = z.TypeOf<typeof SessionInfoModel>;

const UserModel = z.object({
  userId: z.string(),
  recipeId: z.union([z.literal('emailpassword'), z.literal('thirdparty')]),
});

const EmailPasswordUserModel = z.object({
  userId: z.string(),
  email: z.string(),
  passwordHash: z.string(),
  timeJoined: z.number(),
});

type EmailPasswordUser = z.TypeOf<typeof EmailPasswordUserModel>;

const ThirdpartUserModel = z.object({
  thirdPartyId: z.string(),
  thirdPartyUserId: z.string(),
  userId: z.string(),
  email: z.string(),
  timeJoined: z.number(),
});

export const EmailPasswordOrThirdPartyUserModel = z.union([
  EmailPasswordUserModel,
  ThirdpartUserModel,
]);

export type EmailPasswordOrThirdPartyUser = z.TypeOf<typeof EmailPasswordOrThirdPartyUserModel>;

const EmailPasswordResetTokenModel = z.object({
  userId: z.string(),
  token: z.string(),
  email: z.string(),
  tokenExpiry: z.number(),
});

export class SuperTokensStore {
  private logger: Logger;
  constructor(
    private pool: PostgresDatabasePool,
    logger: Logger,
  ) {
    this.logger = logger.child({ module: 'SuperTokensStore' });
  }

  async getSessionInfo(sessionHandle: string) {
    this.logger.debug('Lookup session. (sessionHandle=%s)', sessionHandle);

    const query = psql`
      SELECT
        "session_handle" AS "sessionHandle"
        , "user_id" AS "userId"
        , "session_data" AS "sessionData"
        , "expires_at" AS "expiresAt"
        , "created_at_time" AS "createdAt"
        , "refresh_token_hash_2" AS "refreshTokenHash2"
      FROM
        "supertokens_session_info"
      WHERE
        "app_id" = 'public'
        AND "tenant_id" = 'public'
        AND "session_handle" = ${sessionHandle}
    `;

    const result = await this.pool.maybeOne(query);
    const record = SessionInfoModel.nullable().parse(result);
    if (!record) {
      this.logger.debug('Session not found (sessionHandle=%s)', sessionHandle);
      return null;
    }

    this.logger.debug('Session found (sessionHandle=%s)', sessionHandle);
    return record;
  }

  async deleteSession(sessionHandle: string) {
    this.logger.debug('Delete session. (sessionHandle=%s)', sessionHandle);

    const query = psql`
      DELETE
      FROM "supertokens_session_info"
      WHERE
        "app_id" = 'public'
        AND "tenant_id" = 'public'
        AND "session_handle" = ${sessionHandle}
    `;

    await this.pool.query(query);
  }

  async invalidateAllSessionsForUser(userId: string, trx: CommonQueryMethods = this.pool) {
    this.logger.debug('Invalidate session for user. (userId=%s)', userId);

    const query = psql`
      DELETE
      FROM "supertokens_session_info"
      WHERE
        "app_id" = 'public'
        AND "tenant_id" = 'public'
        AND "user_id" = ${userId}
    `;

    await trx.query(query);
  }

  async findEmailPasswordUserByEmail(email: string) {
    const query = psql`
      SELECT
        "user_id" AS "userId"
        , "email" AS "email"
        , "password_hash" AS "passwordHash"
        , "time_joined" AS "timeJoined"
      FROM
       "supertokens_emailpassword_users"
      WHERE
        "app_id" = 'public'
        AND "email" = lower(${email})
    `;

    const record = await this.pool.maybeOne(query).then(EmailPasswordUserModel.nullable().parse);
    return record;
  }

  private async lookupEmailUserByUserId(userId: string) {
    const query = psql`
      SELECT
        "user_id" AS "userId"
        , "email" AS "email"
        , "password_hash" AS "passwordHash"
        , "time_joined" AS "timeJoined"
      FROM
       "supertokens_emailpassword_users"
      WHERE
        "app_id" = 'public'
        AND "user_id" = ${userId}
    `;

    const record = await this.pool.maybeOne(query).then(EmailPasswordUserModel.nullable().parse);
    return record;
  }

  public async lookupEmailUserByEmail(email: string) {
    const userToTenantQuery = psql`
      SELECT
        "user_id" AS "userId"
      FROM
        "supertokens_emailpassword_user_to_tenant"
      WHERE
        "app_id" = 'public'
        AND "tenant_id" = 'public'
        AND "email" = lower(${email})
    `;

    const userId = await this.pool
      .maybeOneFirst(userToTenantQuery)
      .then(z.string().nullable().parse);

    if (!userId) {
      return null;
    }

    const query = psql`
      SELECT
        "user_id" AS "userId"
        , "email" AS "email"
        , "password_hash" AS "passwordHash"
        , "time_joined" AS "timeJoined"
      FROM
       "supertokens_emailpassword_users"
      WHERE
        "app_id" = 'public'
        AND "user_id" = ${userId}
    `;

    const record = await this.pool.maybeOne(query).then(EmailPasswordUserModel.nullable().parse);
    return record;
  }

  private async lookupThirdPartyUserByUserId(userId: string) {
    const query = psql`
      SELECT
        "user_id" AS "userId"
        , "email" AS "email"
        , "third_party_id" AS "thirdPartyId"
        , "third_party_user_id" AS "thirdPartyUserId"
        , "time_joined" AS "timeJoined"
      FROM
       "supertokens_thirdparty_users"
      WHERE
        "app_id" = 'public'
        AND "user_id" = ${userId}
    `;

    const record = await this.pool.maybeOne(query).then(ThirdpartUserModel.nullable().parse);
    return record;
  }

  async lookupUserByUserId(userId: string) {
    this.logger.debug('Lookup user. (userId=%s)', userId);

    const query = psql`
      SELECT
        "user_id" AS "userId"
        , "recipe_id" AS "recipeId"
      FROM
        "supertokens_all_auth_recipe_users"
      WHERE
        "app_id" = 'public'
        AND "tenant_id" = 'public'
        AND "user_id" = ${userId}
    `;

    const record = await this.pool.maybeOne(query).then(UserModel.nullable().parse);

    if (!record) {
      return null;
    }

    if (record.recipeId === 'emailpassword') {
      return this.lookupEmailUserByUserId(record.userId);
    }

    if (record.recipeId === 'thirdparty') {
      return this.lookupThirdPartyUserByUserId(record.userId);
    }

    return null;
  }

  async createSession(
    sessionHandle: string,
    userId: string,
    sessionDataInDatabase: string,
    accessTokenPayload: string,
    refreshTokenHash2: string,
    expiresAt: number,
  ) {
    const query = psql`
      INSERT INTO "supertokens_session_info" (
        "app_id"
        , "tenant_id"
        , "session_handle"
        , "user_id"
        , "refresh_token_hash_2"
        , "session_data"
        , "expires_at"
        , "jwt_user_payload"
        , "use_static_key"
        , "created_at_time"
      ) VALUES (
        'public'
        , 'public'
        , ${sessionHandle}
        , ${userId}
        , ${refreshTokenHash2}
        , ${sessionDataInDatabase}
        , ${expiresAt}
        , ${accessTokenPayload}
        , false
        , ${Date.now()}
      )
      RETURNING
        "session_handle" AS "sessionHandle"
        , "user_id" AS "userId"
        , "session_data" AS "sessionData"
        , "expires_at" AS "expiresAt"
        , "created_at_time" AS "createdAt"
        , "refresh_token_hash_2" AS "refreshTokenHash2"
    `;

    return await this.pool.one(query).then(SessionInfoModel.parse);
  }

  async updateSessionRefreshHash(
    sessionHandle: string,
    lastRefreshTokenHash2: string,
    newRefreshTokenHash2: string,
  ) {
    const query = psql`
      UPDATE
        "supertokens_session_info"
      SET
        "refresh_token_hash_2" = ${newRefreshTokenHash2}
      WHERE
        "app_id" = 'public'
        AND "tenant_id" = 'public'
        AND "session_handle" = ${sessionHandle}
        AND "refresh_token_hash_2" = ${lastRefreshTokenHash2}
      RETURNING
        "session_handle" AS "sessionHandle"
        , "user_id" AS "userId"
        , "session_data" AS "sessionData"
        , "expires_at" AS "expiresAt"
        , "created_at_time" AS "createdAt"
        , "refresh_token_hash_2" AS "refreshTokenHash2"
    `;

    return await this.pool.maybeOne(query).then(SessionInfoModel.nullable().parse);
  }

  async findThirdPartyUser(
    args: { thirdPartyId: string; thirdPartyUserId: string },
    trx: CommonQueryMethods = this.pool,
  ) {
    const query = psql`
      SELECT
        "user_id" AS "userId"
        , "email" AS "email"
        , "third_party_id" AS "thirdPartyId"
        , "third_party_user_id" AS "thirdPartyUserId"
        , "time_joined" AS "timeJoined"
      FROM
        "supertokens_thirdparty_users"
      WHERE
        "app_id" = 'public'
        AND "third_party_id" = ${args.thirdPartyId}
        AND "third_party_user_id" = ${args.thirdPartyUserId}
    `;

    return await trx.maybeOne(query).then(ThirdpartUserModel.nullable().parse);
  }

  async findOIDCUserByExternalIdAndOIDCIntegrationId(
    args: { externalId: string; oidcIntegrationId: string },
    trx: CommonQueryMethods = this.pool,
  ) {
    return this.findThirdPartyUser(
      {
        thirdPartyId: 'oidc',
        thirdPartyUserId: `${args.oidcIntegrationId}-${args.externalId}`,
      },
      trx,
    );
  }

  async updateOIDCUserEmail(
    args: { userId: string; newEmail: string },
    trx: CommonQueryMethods = this.pool,
  ) {
    const query = psql`
      UPDATE
        "supertokens_thirdparty_users"
      SET
        "email" = lower(${args.newEmail})
      WHERE
        "app_id" = 'public'
        AND "third_party_id" = 'oidc'
        AND "user_id" = ${args.userId}
      RETURNING
        "user_id" AS "userId"
        , "email" AS "email"
        , "third_party_id" AS "thirdPartyId"
        , "third_party_user_id" AS "thirdPartyUserId"
        , "time_joined" AS "timeJoined"
    `;

    return await trx.maybeOne(query).then(ThirdpartUserModel.nullable().parse);
  }

  async createThirdPartyUser(
    args: {
      email: string;
      thirdPartyId: string;
      thirdPartyUserId: string;
    },
    trx: CommonQueryMethods = this.pool,
  ) {
    const userId = crypto.randomUUID();
    const now = Date.now();

    const allRecipeUsersQuery = psql`
      INSERT INTO "supertokens_all_auth_recipe_users" (
        "app_id"
        , "tenant_id"
        , "user_id"
        , "primary_or_recipe_user_id"
        , "is_linked_or_is_a_primary_user"
        , "recipe_id"
        , "time_joined"
        , "primary_or_recipe_user_time_joined"
      ) VALUES (
        'public'
        , 'public'
        , ${userId}
        , ${userId}
        , false
        , 'thirdparty'
        , ${now}
        , ${now}
      )
    `;

    const oidcUserQuery = psql`
      INSERT INTO "supertokens_thirdparty_users" (
        "app_id"
        , "third_party_id"
        , "third_party_user_id"
        , "user_id"
        , "email"
        , "time_joined"
      ) VALUES (
        'public'
        , ${args.thirdPartyId}
        , ${args.thirdPartyUserId}
        , ${userId}
        , lower(${args.email})
        , ${now}
      )
      RETURNING
        "user_id" AS "userId"
        , "email" AS "email"
        , "third_party_id" AS "thirdPartyId"
        , "third_party_user_id" AS "thirdPartyUserId"
        , "time_joined" AS "timeJoined"
    `;

    const appIdToUserIdQuery = psql`
      INSERT INTO "supertokens_app_id_to_user_id" (
        "app_id"
        , "user_id"
        , "recipe_id"
        , "primary_or_recipe_user_id"
        , "is_linked_or_is_a_primary_user"
      ) VALUES (
        'public'
        , ${userId}
        , 'thirdparty'
        , ${userId}
        , false
      )
    `;

    const thirdpartyUserToTenant = psql`
      INSERT INTO "supertokens_thirdparty_user_to_tenant" (
        "app_id"
        , "tenant_id"
        , "user_id"
        , "third_party_id"
        , "third_party_user_id"
      ) VALUES (
        'public'
        , 'public'
        , ${userId}
        , ${args.thirdPartyId}
        , ${args.thirdPartyUserId}
      )
    `;

    return await trx
      .transaction('createThirdPartyUser', async t => {
        await t.query(appIdToUserIdQuery);
        const result = await t.one(oidcUserQuery);
        await t.query(allRecipeUsersQuery);
        await t.query(thirdpartyUserToTenant);
        return result;
      })
      .then(r => ThirdpartUserModel.parse(r));
  }

  async createOIDCUser(
    args: { email: string; externalId: string; oidcIntegrationId: string },
    trx: CommonQueryMethods = this.pool,
  ) {
    return this.createThirdPartyUser(
      {
        email: args.email,
        thirdPartyId: 'oidc',
        thirdPartyUserId: args.oidcIntegrationId + '-' + args.externalId,
      },
      trx,
    );
  }

  async createOIDCUserIfNotExists(
    args: { email: string; externalId: string; oidcIntegrationId: string },
    trx: CommonQueryMethods = this.pool,
  ) {
    const existingUser = await this.findOIDCUserByExternalIdAndOIDCIntegrationId(args, trx);
    if (existingUser) {
      this.logger.debug('supertokens user already exists.');
      return existingUser;
    }
    this.logger.debug('supertokens does not yet exist. Create it.');
    return await this.createOIDCUser(args, trx);
  }

  async updateOIDCUserExternalId(
    args: { userId: string; oidcIntegrationId: string; externalId: string },
    trx: CommonQueryMethods,
  ) {
    await trx.query(psql`
      UPDATE "supertokens_thirdparty_users"
      SET
        "third_party_user_id" = ${`${args.oidcIntegrationId}-${args.externalId}`}
      WHERE
        "app_id" = 'public'
        AND "third_party_id" = 'oidc'
        AND "user_id" = ${args.userId}
    `);
  }

  async createEmailPasswordUser(args: { email: string; passwordHash: string }) {
    const userId = crypto.randomUUID();
    const now = Date.now();
    const allRecipeUsersQuery = psql`
      INSERT INTO "supertokens_all_auth_recipe_users" (
        "app_id"
        , "tenant_id"
        , "user_id"
        , "primary_or_recipe_user_id"
        , "is_linked_or_is_a_primary_user"
        , "recipe_id"
        , "time_joined"
        , "primary_or_recipe_user_time_joined"
      ) VALUES (
        'public'
        , 'public'
        , ${userId}
        , ${userId}
        , false
        , 'emailpassword'
        , ${now}
        , ${now}
      )
    `;

    const emailPasswordUserQuery = psql`
      INSERT INTO "supertokens_emailpassword_users" (
        "app_id"
        , "user_id"
        , "email"
        , "password_hash"
        , "time_joined"
      ) VALUES (
        'public'
        , ${userId}
        , lower(${args.email})
        , ${args.passwordHash}
        , ${now}
      )
      RETURNING
        "user_id" AS "userId"
        , "email" AS "email"
        , "password_hash" AS "passwordHash"
        , "time_joined" AS "timeJoined"
    `;

    const appIdToUserIdQuery = psql`
      INSERT INTO "supertokens_app_id_to_user_id" (
        "app_id"
        , "user_id"
        , "recipe_id"
        , "primary_or_recipe_user_id"
        , "is_linked_or_is_a_primary_user"
      ) VALUES (
        'public'
        , ${userId}
        , 'emailpassword'
        , ${userId}
        , false
      )
    `;

    const userToTenantQuery = psql`
      INSERT INTO "supertokens_emailpassword_user_to_tenant" (
        "app_id"
        , "tenant_id"
        , "user_id"
        , "email"
      ) VALUES (
        'public'
        , 'public'
        , ${userId}
        , lower(${args.email})
      )
    `;

    return await this.pool
      .transaction('createEmailPasswordUser', async t => {
        await t.query(appIdToUserIdQuery);
        const result = await t.one(emailPasswordUserQuery);
        await t.query(allRecipeUsersQuery);
        await t.query(userToTenantQuery);
        return result;
      })
      .then(r => EmailPasswordUserModel.parse(r));
  }

  async createEmailPasswordResetToken(args: {
    user: EmailPasswordUser;
    token: string;
    expiresAt: number;
  }) {
    const deletePendingRequestsQuery = psql`
      DELETE
      FROM "supertokens_emailpassword_pswd_reset_tokens"
      WHERE
        "app_id" = 'public'
        AND "user_id" =${args.user.userId}
    `;

    const query = psql`
      INSERT INTO "supertokens_emailpassword_pswd_reset_tokens" (
        "app_id"
        , "user_id"
        , "token"
        , "email"
        , "token_expiry"
      ) VALUES (
       'public'
       , ${args.user.userId}
       , ${args.token}
       , lower(${args.user.email})
       , ${args.expiresAt}
      )
      RETURNING
        "user_id" AS "userId"
        , "token"
        , "email"
        , "token_expiry" AS "tokenExpiry"
    `;

    return await this.pool.transaction('createEmailPasswordResetToken', async t => {
      await t.query(deletePendingRequestsQuery);
      return await t.one(query).then(EmailPasswordResetTokenModel.parse);
    });
  }

  async updateEmailPasswordBasedOnResetToken(args: { token: string; newPasswordHash: string }) {
    const emailPasswordResetTokenQuery = psql`
      DELETE
      FROM
        "supertokens_emailpassword_pswd_reset_tokens"
      WHERE
        "token" = ${args.token}
      RETURNING
        "user_id" AS "userId"
        , "token"
        , "email"
        , "token_expiry" AS "tokenExpiry"
    `;

    const updatePasswordHash = (userId: string) => psql`
      UPDATE "supertokens_emailpassword_users"
      SET
        "password_hash" = ${args.newPasswordHash}
      WHERE
        "app_id" = 'public'
        AND "user_id" = ${userId}
      RETURNING
        "user_id" AS "userId"
        , "email" AS "email"
        , "password_hash" AS "passwordHash"
        , "time_joined" AS "timeJoined"
    `;

    return await this.pool.transaction('updateEmailPasswordBasedOnResetToken', async t => {
      const resetToken = await t
        .maybeOne(emailPasswordResetTokenQuery)
        .then(EmailPasswordResetTokenModel.nullable().parse);

      // Unknown or already used (the delete found nothing), or past its expiry: the handler answers
      // with an invalid-token status.
      if (!resetToken || resetToken.tokenExpiry < Date.now()) {
        return null;
      }

      return await t.one(updatePasswordHash(resetToken.userId)).then(EmailPasswordUserModel.parse);
    });
  }
}
