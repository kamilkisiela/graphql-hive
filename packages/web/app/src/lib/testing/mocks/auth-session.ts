import type { FrontTokenSnapshot, Session } from '@/lib/auth/session';

/** Stand-in for `@/lib/auth/session`: a signed-in session that never refreshes. */
const session: Session = {
  userId: 'user-1',
  email: 'user@the-guild.dev',
  oidcIntegrationId: null,
  accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
};
const snapshot: FrontTokenSnapshot = { status: 'valid', raw: 'stand-in', session };

const standIn: typeof import('@/lib/auth/session') = {
  getSnapshot: () => snapshot,
  getSession: () => session,
  subscribe: () => () => {},
  isUsable: () => true,
  doesSessionExist: async () => true,
  attemptRefreshingSession: async () => true,
  signOut: async () => {},
};

export const {
  getSnapshot,
  getSession,
  subscribe,
  isUsable,
  doesSessionExist,
  attemptRefreshingSession,
  signOut,
} = standIn;
