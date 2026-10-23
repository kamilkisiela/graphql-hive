// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { applyFrontTokenHeader, clearFrontToken } from './front-token';
import { useSession } from './use-session';

vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));

const refreshSession = vi.hoisted(() => vi.fn<() => Promise<number>>());
vi.mock('./api', () => ({ refreshSession, signOut: async () => {} }));

function encode(ate: number): string {
  return btoa(JSON.stringify({ uid: 'user-1', ate, up: { email: 'user@the-guild.dev' } }));
}

describe('useSession', () => {
  beforeEach(() => {
    refreshSession.mockReset();
    clearFrontToken();
  });

  it('is anonymous right away without a token', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current).toEqual({ loading: false, doesSessionExist: false });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('is signed in right away with a usable token', () => {
    applyFrontTokenHeader(encode(Date.now() + 60_000));
    const { result } = renderHook(() => useSession());
    expect(result.current).toEqual({
      loading: false,
      doesSessionExist: true,
      userId: 'user-1',
      email: 'user@the-guild.dev',
    });
  });

  it('loads while an expired token refreshes, then is signed in', async () => {
    applyFrontTokenHeader(encode(Date.now() - 60_000));
    let finish!: (status: number) => void;
    refreshSession.mockImplementation(
      () =>
        new Promise<number>(resolve => {
          finish = status => {
            applyFrontTokenHeader(encode(Date.now() + 60_000));
            resolve(status);
          };
        }),
    );

    const { result } = renderHook(() => useSession());
    expect(result.current).toEqual({ loading: true });

    await act(async () => finish(200));
    await waitFor(() => expect(result.current).toMatchObject({ doesSessionExist: true }));
  });

  it('is anonymous once the refresh reports the session gone', async () => {
    applyFrontTokenHeader(encode(Date.now() - 60_000));
    refreshSession.mockResolvedValue(404);
    const { result } = renderHook(() => useSession());
    await waitFor(() =>
      expect(result.current).toEqual({ loading: false, doesSessionExist: false }),
    );
  });

  it('settles optimistically when the refresh fails transiently', async () => {
    applyFrontTokenHeader(encode(Date.now() - 60_000));
    refreshSession.mockResolvedValue(401);
    const { result } = renderHook(() => useSession());
    await waitFor(() =>
      expect(result.current).toMatchObject({ loading: false, doesSessionExist: true }),
    );
  });

  it('loads while an unreadable token refreshes and is anonymous when that fails', async () => {
    document.cookie = 'sFrontToken=garbage; path=/';
    let finish!: (status: number) => void;
    refreshSession.mockImplementation(
      () =>
        new Promise<number>(resolve => {
          finish = resolve;
        }),
    );

    const { result } = renderHook(() => useSession());
    expect(result.current).toEqual({ loading: true });

    await act(async () => finish(401));
    await waitFor(() =>
      expect(result.current).toEqual({ loading: false, doesSessionExist: false }),
    );
  });

  it('keeps the same result object across re-renders while nothing changed', async () => {
    applyFrontTokenHeader(encode(Date.now() + 60_000));
    const { result, rerender } = renderHook(() => useSession());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    // The mount-time check resolves after render; it must not hand out a new object either.
    await act(async () => {});
    expect(result.current).toBe(first);

    clearFrontToken();
    const { result: anonymous, rerender: rerenderAnonymous } = renderHook(() => useSession());
    const firstAnonymous = anonymous.current;
    rerenderAnonymous();
    expect(anonymous.current).toBe(firstAnonymous);
  });

  it('reacts to a sign-out', async () => {
    applyFrontTokenHeader(encode(Date.now() + 60_000));
    const { result } = renderHook(() => useSession());
    act(() => clearFrontToken());
    expect(result.current).toEqual({ loading: false, doesSessionExist: false });
  });
});
