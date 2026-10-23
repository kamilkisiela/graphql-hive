import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Inject, Injectable } from 'graphql-modules';
import zod from 'zod';
import { PostgresDatabasePool, psql, TaggedTemplateLiteralInvocation } from '@hive/postgres';
import { FastifyRequest } from '@hive/service-common';
import { TaskScheduler } from '@hive/workflows/kit';
import {
  EMAIL_VERIFICATION_LINK_VALID_MINUTES,
  EmailVerificationTask,
} from '@hive/workflows/tasks/email-verification';
import { HiveError } from '../../../shared/errors';
import { RedisRateLimiter } from '../../shared/providers/redis-rate-limiter';
import { WEB_APP_URL } from '../../shared/providers/tokens';

const EmailVerificationModelBase = zod.object({
  id: zod.string().uuid(),
  userIdentityId: zod.string(),
  email: zod.string().email(),
  createdAt: zod.number().transform(v => new Date(v)),
});

const UnverifiedEmailVerificationModel = EmailVerificationModelBase.extend({
  tokenHash: zod.string(),
  expiresAt: zod.number().transform(v => new Date(v)),
  verifiedAt: zod.null(),
});

const VerifiedEmailVerificationModel = EmailVerificationModelBase.extend({
  tokenHash: zod.string().nullable(),
  expiresAt: zod.null(),
  verifiedAt: zod.number().transform(v => new Date(v)),
});

const EmailVerificationModel = zod.union([
  UnverifiedEmailVerificationModel,
  VerifiedEmailVerificationModel,
]);

const emailVerificationFields = (r: TaggedTemplateLiteralInvocation) => psql`
  ${r}"id" AS "id"
  , ${r}"user_identity_id" AS "userIdentityId"
  , ${r}"email" AS "email"
  , ${r}"token_hash" AS "tokenHash"
  , ${r}"created_at" AS "createdAt"
  , ${r}"expires_at" AS "expiresAt"
  , ${r}"verified_at" AS "verifiedAt"
`;

/**
 * Responsible for email verification.
 * Talks to Storage.
 */
@Injectable({
  global: true,
})
export class EmailVerification {
  constructor(
    private taskScheduler: TaskScheduler,
    @Inject(WEB_APP_URL) private appBaseUrl: string,
    private pool: PostgresDatabasePool,
    private rateLimiter: RedisRateLimiter,
  ) {}

  async checkUserEmailVerified(input: { userIdentityId: string; email: string }) {
    const { provider } = await this.pool
      .one(
        psql`
          SELECT COALESCE("stu"."third_party_id", 'emailpassword') "provider"
          FROM "supertokens_all_auth_recipe_users" "saaru"
          LEFT JOIN "supertokens_thirdparty_users" "stu"
          ON "saaru"."user_id" = "stu"."user_id"
          WHERE "saaru"."user_id" = ${input.userIdentityId}
        `,
      )
      .then(v =>
        zod.object({ provider: zod.enum(['emailpassword', 'google', 'github', 'oidc']) }).parse(v),
      );

    if (provider === 'google' || provider === 'github') {
      return { verified: true };
    }

    const emailVerification = await this.pool
      .maybeOne(
        psql`
          SELECT ${emailVerificationFields(psql`"ev".`)}
          FROM "email_verifications" "ev"
          WHERE
            "ev"."user_identity_id" = ${input.userIdentityId}
            AND lower("ev"."email") = lower(${input.email})
            AND "ev"."verified_at" IS NOT NULL
          LIMIT 1
        `,
      )
      .then(v => EmailVerificationModel.nullable().parse(v));

    return {
      verified: emailVerification?.verifiedAt != null,
    };
  }

  async sendVerificationEmail(
    input: {
      userIdentityId: string;
      resend?: boolean;
    },
    req: FastifyRequest,
  ): Promise<
    | { ok: true; expiresAt: Date }
    | {
        ok: false;
        message: string;
        emailAlreadyVerified: boolean;
      }
  > {
    if (await this.rateLimiter.isActionRateLimited(req, 'sendVerificationEmail', 60 * 5, 10)) {
      throw new HiveError('Exceeded rate limit for sending verification emails.');
    }

    const superTokensUser = await this.pool
      .maybeOne(
        psql`
          SELECT COALESCE("seu"."email", "stu"."email") "email"
          FROM "supertokens_all_auth_recipe_users" "saaru"
          LEFT JOIN "supertokens_emailpassword_users" "seu"
          ON "saaru"."user_id" = "seu"."user_id"
          LEFT JOIN "supertokens_thirdparty_users" "stu"
          ON "saaru"."user_id" = "stu"."user_id"
          WHERE "saaru"."user_id" = ${input.userIdentityId}
        `,
      )
      .then(v => zod.object({ email: zod.string().email() }).nullable().parse(v));

    if (!superTokensUser) {
      throw new HiveError('User identity not found.');
    }

    const existingVerification = await this.pool
      .maybeOne(
        psql`
          SELECT ${emailVerificationFields(psql`"ev".`)}
          FROM "email_verifications" "ev"
          WHERE
            "ev"."user_identity_id" = ${input.userIdentityId}
            AND lower("ev"."email") = lower(${superTokensUser.email})
        `,
      )
      .then(v => EmailVerificationModel.nullable().parse(v));

    if (existingVerification?.verifiedAt) {
      return {
        ok: false,
        message: 'Your email address has already been verified.',
        emailAlreadyVerified: true,
      };
    }

    if (existingVerification && !input.resend) {
      return {
        ok: true,
        expiresAt: existingVerification.expiresAt,
      };
    }

    const token = randomBytes(16).toString('hex');
    const tokenHash = await bcrypt.hash(token, await bcrypt.genSalt());
    const newVerification = await this.pool
      .one(
        psql`
          INSERT INTO "email_verifications" AS "ev" (
            "user_identity_id"
            , "email"
            , "token_hash"
            , "expires_at"
          )
          VALUES (
            ${input.userIdentityId}
            , ${superTokensUser.email}
            , ${tokenHash}
            , now() + make_interval(mins => ${EMAIL_VERIFICATION_LINK_VALID_MINUTES})
          )
          ON CONFLICT ("user_identity_id", "email") DO UPDATE SET
            "token_hash" = EXCLUDED.token_hash
            , "expires_at" = EXCLUDED.expires_at
            , "verified_at" = NULL
          RETURNING ${emailVerificationFields(psql`"ev".`)}
        `,
      )
      .then<zod.output<typeof UnverifiedEmailVerificationModel>>(v =>
        UnverifiedEmailVerificationModel.parse(v),
      );

    await this.taskScheduler.scheduleTask(EmailVerificationTask, {
      user: {
        email: superTokensUser.email,
      },
      emailVerifyLink: `${this.appBaseUrl}/auth/verify-email?userIdentityId=${newVerification.userIdentityId}&email=${encodeURIComponent(superTokensUser.email)}&token=${token}`,
    });

    return {
      ok: true,
      expiresAt: newVerification.expiresAt,
    };
  }

  async verifyEmail(input: {
    userIdentityId: string;
    email: string;
    token: string;
  }): Promise<{ ok: true; verified: boolean } | { ok: false; message: string }> {
    const emailVerification = await this.pool
      .maybeOne(
        psql`
          SELECT ${emailVerificationFields(psql`"ev".`)}
          FROM "email_verifications" "ev"
          WHERE
            "user_identity_id" = ${input.userIdentityId}
            AND lower("email") = lower(${input.email})
            AND "expires_at" IS NOT NULL
            AND "verified_at" IS NULL
        `,
      )
      .then(v => UnverifiedEmailVerificationModel.nullable().parse(v));

    const isTokenValid = emailVerification
      ? await bcrypt.compare(input.token, emailVerification.tokenHash)
      : false;

    if (!emailVerification || !isTokenValid) {
      return {
        ok: false,
        message: 'The email verification link is invalid.',
      };
    }

    if (emailVerification.expiresAt.getTime() <= Date.now()) {
      await this.pool.query(psql`
        DELETE FROM "email_verifications"
        WHERE "id" = ${emailVerification.id}
      `);

      return {
        ok: false,
        message: 'The email verification link has expired.',
      };
    }

    await this.pool.query(psql`
      UPDATE "email_verifications"
      SET
        "verified_at" = now()
        , "expires_at" = NULL
      WHERE "id" = ${emailVerification.id}
    `);

    return {
      ok: true,
      verified: true,
    };
  }
}
