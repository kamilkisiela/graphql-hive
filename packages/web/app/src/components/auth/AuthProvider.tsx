import { createContext, useContext, FC, useEffect } from 'react';
import { configureScope } from '@sentry/nextjs';
import { reset, identify } from '@/lib/mixpanel';
import { UserProvider, useUser as useAuth0User, UserProfile } from '@auth0/nextjs-auth0';
import { Spinner } from '@/components/common/Spinner';
import { LoginPage } from './LoginPage';

const AuthContext = createContext<{
  user: (UserProfile & { metadata: Metadata }) | null;
}>({
  user: null,
});

export const useUser = () => useContext(AuthContext);

declare global {
  interface Window {
    $crisp: any;
  }
}

function identifyOnCrisp(user: UserProfile): void {
  const crisp = globalThis.$crisp;
  if (crisp) {
    pushIfNotEmpty(crisp, 'user:email', user.email);
    pushIfNotEmpty(crisp, 'user:nickname', user.name || user.nickname);
    pushIfNotEmpty(crisp, 'user:avatar', user.picture);
  }
}

function pushIfNotEmpty(crisp: any, key: string, value: string): void {
  if (value) {
    crisp.push(['set', key, value]);
  }
}

function identifyOnSentry(user: UserProfile): void {
  const sub = user.sub;

  if (sub) {
    const [provider, id] = sub.split('|');
    const maxLen = 10;

    // Why? Sentry hides a user id when it looks similar to an api key (long hash)
    const userId = `${provider}|${id.length > maxLen ? id.substr(0, maxLen) + '...' : id}`;

    configureScope(scope => {
      scope.setUser({
        id: userId,
      });
    });
  }
}

interface Metadata {
  admin?: boolean;
}

const AuthProviderInner: FC = ({ children }) => {
  const { user, isLoading } = useAuth0User();

  useEffect(() => {
    if (!isLoading && user) {
      identify(user);
      identifyOnCrisp(user);
      identifyOnSentry(user);
    }
  }, [isLoading, user]);

  if (isLoading) {
    return <Spinner />;
  }

  if (!user) {
    reset();
    return <LoginPage />;
  }

  return (
    <AuthContext.Provider
      value={{
        user: {
          ...user,
          metadata: user['https://graphql-hive.com/metadata'] as Metadata,
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: FC = ({ children }) => {
  return (
    <UserProvider>
      <AuthProviderInner>{children}</AuthProviderInner>
    </UserProvider>
  );
};
