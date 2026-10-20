import { useEffect, useState, useSyncExternalStore } from 'react';
import { doesSessionExist, getSnapshot, isUsable, subscribe } from './session';

export type SessionState =
  | { loading: true }
  | { loading: false; doesSessionExist: false }
  | { loading: false; doesSessionExist: true; userId: string; email: string | undefined };

/**
 * The session for rendering. A usable token answers synchronously; a present but expired or
 * unreadable one reports `loading` until the mount-time refresh settles, so a sign-in page never
 * bounces to `/` on a token the API would reject.
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

  if (snapshot.status === 'absent') {
    return { loading: false, doesSessionExist: false };
  }
  if (!isUsable(snapshot)) {
    if (checked === null) {
      return { loading: true };
    }
    if (!checked || snapshot.status !== 'valid') {
      return { loading: false, doesSessionExist: false };
    }
  }
  if (snapshot.status !== 'valid') {
    return { loading: false, doesSessionExist: false };
  }
  return {
    loading: false,
    doesSessionExist: true,
    userId: snapshot.session.userId,
    email: snapshot.session.email,
  };
}
