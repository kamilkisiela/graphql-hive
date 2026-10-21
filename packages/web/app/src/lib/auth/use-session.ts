import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { doesSessionExist, getSnapshot, isUsable, subscribe } from './session';

export type SessionState =
  | { loading: true }
  | { loading: false; doesSessionExist: false }
  | { loading: false; doesSessionExist: true; userId: string; email: string | undefined };

const LOADING: SessionState = { loading: true };
const ANONYMOUS: SessionState = { loading: false, doesSessionExist: false };

/**
 * The session for rendering. A usable token answers synchronously; a present but expired or
 * unreadable one reports `loading` until the mount-time refresh settles, so a sign-in page never
 * bounces to `/` on a token the API would reject. The result keeps its identity while nothing
 * changed, so it is safe in effect and callback dependencies.
 */
export function useSession(): SessionState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const [checked, setChecked] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void doesSessionExist().then(exists => {
      if (!cancelled) {
        setChecked(exists);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The mount check only matters for a token the API would reject; keeping it out of the memo
  // otherwise means its arrival does not hand consumers a new object.
  const pending = snapshot.status !== 'absent' && !isUsable(snapshot) ? checked : null;

  return useMemo((): SessionState => {
    if (snapshot.status !== 'valid') {
      return pending === null || pending === false ? ANONYMOUS : LOADING;
    }
    if (pending === null && !isUsable(snapshot)) {
      return LOADING;
    }
    if (pending === false) {
      return ANONYMOUS;
    }
    return {
      loading: false,
      doesSessionExist: true,
      userId: snapshot.session.userId,
      email: snapshot.session.email,
    };
  }, [snapshot, pending]);
}
