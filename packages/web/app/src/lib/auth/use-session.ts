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

  return useMemo((): SessionState => {
    if (snapshot.status === 'absent') {
      return ANONYMOUS;
    }
    if (!isUsable(snapshot)) {
      if (checked === null) {
        return LOADING;
      }
      if (!checked || snapshot.status !== 'valid') {
        return ANONYMOUS;
      }
    }
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
