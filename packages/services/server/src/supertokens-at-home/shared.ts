import { z } from 'zod';
import type { User } from '@hive/api';
import {
  AccessTokenKeyContainer,
  createAccessToken,
  createRefreshToken,
  sha256,
} from '@hive/api/modules/auth/lib/supertokens-at-home/crypto';
import { SuperTokensStore } from '@hive/api/modules/auth/providers/supertokens-store';

export const SuperTokensSessionPayloadV2Model = z.object({
  version: z.literal('2'),
  superTokensUserId: z.string(),
  email: z.string(),
  userId: z.string(),
  oidcIntegrationId: z.string().nullable(),
});

export type SuperTokensSessionPayload = z.TypeOf<typeof SuperTokensSessionPayloadV2Model>;

const PasswordModel = z
  .string()
  .min(10, { message: 'Password must be at least 10 characters long.' })
  // Check 2: At least one uppercase letter
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
  // Check 3: At least one special character
  .regex(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'Password must contain at least one special character.',
  })
  // Check 4: At least one digit
  .regex(/[0-9]/, { message: 'Password must contain at least one digit.' })
  // Check 5: At least one lowercase letter
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' });

export function validatePassword(password: string):
  | {
      status: 'OK';
    }
  | {
      status: 'INVALID';
      message: string;
    } {
  const result = PasswordModel.safeParse(password);

  if (!result.success) {
    return {
      status: 'INVALID',
      message: result.error.message,
    };
  }

  return { status: 'OK' };
}

export async function createNewSession(
  supertokensStore: SuperTokensStore,
  args: {
    superTokensUserId: string;
    hiveUser: User;
    oidcIntegrationId: string | null;
  },
  secrets: {
    refreshTokenKey: string;
    accessTokenKey: AccessTokenKeyContainer;
  },
) {
  const sessionHandle = crypto.randomUUID();
  // 1 week for now
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1_000;

  const refreshToken = createRefreshToken(
    {
      sessionHandle,
      userId: args.superTokensUserId,
      parentRefreshTokenHash1: null,
    },
    secrets.refreshTokenKey,
  );

  const payload: SuperTokensSessionPayload = {
    version: '2',
    superTokensUserId: args.superTokensUserId,
    userId: args.hiveUser.id,
    oidcIntegrationId: args.oidcIntegrationId ?? null,
    email: args.hiveUser.email,
  };

  const stringifiedPayload = JSON.stringify(payload);

  const session = await supertokensStore.createSession(
    sessionHandle,
    args.superTokensUserId,
    stringifiedPayload,
    stringifiedPayload,
    sha256(sha256(refreshToken)),
    expiresAt,
  );

  const accessToken = createAccessToken(
    {
      sub: args.superTokensUserId,
      sessionHandle,
      sessionData: payload,
      refreshTokenHash1: sha256(refreshToken),
      parentRefreshTokenHash1: null,
    },
    secrets.accessTokenKey,
  );

  return {
    session,
    refreshToken,
    accessToken,
  };
}
