import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import { DottedBackground } from '@/components/ui/dotted-background';
import { Meta } from '@/components/ui/meta';
import { HiveLogo } from '@/components/v2/icon';
import { env } from '@/env/frontend';
import { Outlet } from '@tanstack/react-router';

const isOkta = () =>
  env.auth.okta !== null &&
  new URLSearchParams(globalThis.window?.location.search ?? '').get('provider') === 'okta';

export function AuthPage() {
  const session = useSessionContext();

  return (
    <>
      <Meta title="Welcome" />
      <DottedBackground>
        {session.loading ? (
          <HiveLogo animated={false} className="size-16 animate-pulse" />
        ) : (
          <Outlet />
        )}
      </DottedBackground>
    </>
  );
}
