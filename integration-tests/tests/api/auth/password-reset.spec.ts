import { password as seededPassword } from 'testkit/auth';
import { pollFor } from 'testkit/flow';
import { initSeed } from 'testkit/seed';
import { getServiceHost } from 'testkit/utils';
import * as emails from '../../../testkit/emails';

const baseUrl = await getServiceHost('server', 3001).then(r => `http://${r}`);

async function post(path: string, body: unknown): Promise<{ status: string }> {
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    // A hung request fails the test with a reason instead of the suite timeout.
    signal: AbortSignal.timeout(15_000),
  });
  return response.json();
}

function signIn(email: string, password: string) {
  return post('/auth-api/signin', {
    formFields: [
      { id: 'email', value: email },
      { id: 'password', value: password },
    ],
  });
}

function resetPassword(token: string, password: string) {
  return post('/auth-api/user/password/reset', {
    method: 'token',
    token,
    formFields: [{ id: 'password', value: password }],
  });
}

/** The reset email is sent by a background task, so it arrives shortly after the request answers. */
async function waitForResetToken(email: string): Promise<string> {
  let token: string | undefined;
  await pollFor(
    async () => {
      for (const message of await emails.history(email)) {
        token = message.body.match(/[?&](?:amp;)?token=([0-9a-f]+)/)?.[1];
        if (token) {
          return true;
        }
      }
      return false;
    },
    { maxWait: 20_000 },
  );
  if (!token) {
    throw new Error(`No password reset email for ${email}`);
  }
  return token;
}

test.concurrent('an unknown reset token is refused', async ({ expect }) => {
  await expect(resetPassword('0'.repeat(64), 'Ilikebigturtles!47')).resolves.toEqual({
    status: 'RESET_PASSWORD_INVALID_TOKEN_ERROR',
  });
});

test.concurrent(
  'a reset token changes the password once and is refused afterwards',
  async ({ expect }) => {
    const { ownerEmail } = await initSeed().createOwner();
    const newPassword = 'Ilikebigturtles!47';

    await expect(
      post('/auth-api/user/password/reset/token', {
        formFields: [{ id: 'email', value: ownerEmail }],
      }),
    ).resolves.toEqual({ status: 'OK' });
    const token = await waitForResetToken(ownerEmail);

    await expect(resetPassword(token, newPassword)).resolves.toEqual({ status: 'OK' });
    await expect(signIn(ownerEmail, seededPassword)).resolves.toMatchObject({
      status: 'WRONG_CREDENTIALS_ERROR',
    });
    await expect(signIn(ownerEmail, newPassword)).resolves.toMatchObject({ status: 'OK' });

    await expect(resetPassword(token, 'Anotherturtle!48')).resolves.toEqual({
      status: 'RESET_PASSWORD_INVALID_TOKEN_ERROR',
    });
  },
);
