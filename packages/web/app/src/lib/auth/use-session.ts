import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  doesSessionExist,
  getSnapshot,
  isUsable,
  subscribe,
  type FrontTokenSnapshot,
} from './session';

export type SessionState =
  | { loading: true }
  | { loading: false; doesSessionExist: false }
  | { loading: false; doesSessionExist: true; userId: string; email: string | undefined };

const LOADING: SessionState = { loading: true };
const ANONYMOUS: SessionState = { loading: false, doesSessionExist: false };

/**
 * The session for rendering. A usable token answers synchronously; a present but expired or
 * unreadable one reports `loading` until its refresh settles, so a sign-in page never bounces to
 * `/` on a token the API would reject. The result keeps its identity while nothing changed, so it
 * is safe in effect and callback dependencies.
 */
export function useSession(): SessionState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  // The refresh outcome is tied to the token it checked, so a token written later is judged on
  // its own instead of inheriting it.
  const [checked, setChecked] = useState<{
    snapshot: FrontTokenSnapshot;
    exists: boolean;
  } | null>(null);

  useEffect(() => {
    if (snapshot.status === 'absent' || isUsable(snapshot)) {
      return;
    }
    let cancelled = false;
    void doesSessionExist().then(exists => {
      if (!cancelled) {
        setChecked({ snapshot, exists });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  return useMemo((): SessionState => {
    if (snapshot.status === 'absent') {
      return ANONYMOUS;
    }
    if (!isUsable(snapshot)) {
      if (checked === null || checked.snapshot !== snapshot) {
        return LOADING;
      }
      if (!checked.exists) {
        return ANONYMOUS;
      }
    }
    // An unreadable token the refresh did not replace: there is no user to render.
    if (snapshot.status !== 'valid') {
      return ANONYMOUS;
    }
    return {
      loading: false,
      doesSessionExist: true,
      userId: snapshot.session.userId,
      email: snapshot.session.email,
    };
  }, [snapshot, checked]);
}
