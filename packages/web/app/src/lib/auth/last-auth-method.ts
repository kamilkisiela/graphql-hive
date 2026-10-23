import { useCallback, useMemo, useState } from 'react';
import Cookies from 'js-cookie';

const LAST_USED_AUTH_METHOD_KEY = 'hive:last-used-auth-method';

type AuthProvider = 'github' | 'google' | 'email' | 'okta' | 'oidc';

export function updateLastAuthMethod(provider: AuthProvider) {
  Cookies.set(LAST_USED_AUTH_METHOD_KEY, provider);
}

export function useLastAuthMethod() {
  const [authProvider, setAuthProvider] = useState<AuthProvider | null>(
    (Cookies.get(LAST_USED_AUTH_METHOD_KEY) as AuthProvider) ?? null,
  );

  const updateAuthProvider = useCallback(
    (provider: AuthProvider) => {
      setAuthProvider(provider);
      Cookies.set(LAST_USED_AUTH_METHOD_KEY, provider);
    },
    [setAuthProvider],
  );

  const api = useMemo(
    () => [authProvider, updateAuthProvider] as const,
    [authProvider, updateAuthProvider],
  );

  return api;
}
