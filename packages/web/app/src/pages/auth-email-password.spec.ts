// @vitest-environment jsdom
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
import type { createAppRouter } from '@/router';
import { fireEvent, screen, waitFor } from '@testing-library/react';

// The tree imports every page; these stand in for what cannot load under jsdom.
const requireEmailVerification = vi.hoisted(() => ({ current: false }));
vi.mock('@/env/frontend', async () => {
  const { env } = await import('@/lib/testing/mocks/env');
  return {
    get env() {
      return {
        ...env,
        auth: { ...env.auth, requireEmailVerification: requireEmailVerification.current },
      };
    },
  };
});
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);
vi.mock('@/components/schema-editor', async importOriginal => ({
  ...(await importOriginal<typeof import('@/components/schema-editor')>()),
  SchemaEditor: () => null,
}));
vi.mock('@/components/ui/primitives/chart/chart', () => ({ Chart: () => null }));

// Anonymous until a sign-in or sign-up request answers OK, like the real store would be.
const signedIn = vi.hoisted(() => ({ current: false }));
vi.mock('@/lib/auth/session', async () => {
  const standIn = await import('@/lib/testing/mocks/auth-session');
  // One object per state: `useSyncExternalStore` re-renders on every new snapshot identity.
  const absent = { status: 'absent' } as const;
  return {
    ...standIn,
    getSnapshot: () => (signedIn.current ? standIn.getSnapshot() : absent),
    getSession: () => (signedIn.current ? standIn.getSession() : null),
    doesSessionExist: async () => signedIn.current,
  };
});
const api = vi.hoisted(() => ({
  signIn: vi.fn<(input: unknown) => Promise<{ status: string }>>(),
  signUp: vi.fn<(input: unknown) => Promise<{ status: string }>>(),
}));
vi.mock('@/lib/auth/api', () => api);

function fill(name: string, value: string) {
  fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { value } });
}

function submit() {
  fireEvent.submit(document.querySelector('form')!);
}

// The destination is asserted, not rendered: the real route tree would start its loaders against
// the test client, which answers nothing here.
function spyNavigate(router: ReturnType<typeof createAppRouter>) {
  return vi.spyOn(router, 'navigate').mockResolvedValue(undefined);
}

describe('email and password sign-in', () => {
  beforeEach(() => {
    signedIn.current = false;
    requireEmailVerification.current = false;
    api.signIn.mockReset();
    api.signUp.mockReset();
  });

  it('shows the invalid-credentials toast', async () => {
    api.signIn.mockResolvedValue({ status: 'WRONG_CREDENTIALS_ERROR' });
    renderAtUrl('/auth/sign-in', { client: createTestClient() });
    await screen.findByText('Sign in');

    fill('email', 'user@the-guild.dev');
    fill('password', 'wrong');
    submit();

    // Base UI announces the toast in a live region as well, so the text appears twice.
    await screen.findAllByText('Invalid email or password');
    // react-query passes a mutation context as the second argument.
    expect(api.signIn.mock.calls[0]?.[0]).toEqual({
      email: 'user@the-guild.dev',
      password: 'wrong',
    });
  });

  it('goes back to where the visitor came from after signing in', async () => {
    api.signIn.mockImplementation(async () => {
      signedIn.current = true;
      return { status: 'OK' };
    });
    const { router } = renderAtUrl('/auth/sign-in?redirectToPath=%2Fmanage', {
      client: createTestClient(),
    });
    await screen.findByText('Sign in');
    const navigate = spyNavigate(router);

    fill('email', 'user@the-guild.dev');
    fill('password', 'Password123!');
    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/manage' }));
    // Only onSuccess navigates; the page's own redirect for a signed-in visitor must stay quiet.
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe('email and password sign-up', () => {
  beforeEach(() => {
    signedIn.current = false;
    api.signUp.mockReset();
  });

  async function signUpAt(url: string) {
    api.signUp.mockImplementation(async () => {
      signedIn.current = true;
      return { status: 'OK' };
    });
    const { router } = renderAtUrl(url, { client: createTestClient() });
    await screen.findByText('Create an account');
    const navigate = spyNavigate(router);
    fill('firstName', 'User');
    fill('lastName', 'Example');
    fill('email', 'user@the-guild.dev');
    fill('password', 'Password123!');
    submit();
    return navigate;
  }

  it('continues to the verify-email page when verification is required', async () => {
    requireEmailVerification.current = true;
    const navigate = await signUpAt('/auth/sign-up?redirectToPath=%2Fmanage');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/auth/verify-email' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(api.signUp.mock.calls[0]?.[0]).toEqual({
      firstName: 'User',
      lastName: 'Example',
      email: 'user@the-guild.dev',
      password: 'Password123!',
    });
  });

  it('goes straight to the destination otherwise', async () => {
    requireEmailVerification.current = false;
    const navigate = await signUpAt('/auth/sign-up?redirectToPath=%2Fmanage');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/manage' }));
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
