import { AuthCard, AuthCardContent, AuthCardHeader } from '@/components/auth';
import { DocsLink } from '@/components/v2';
import { env } from '@/env/frontend';
import { startAuthFlowForOIDCProvider } from '@/lib/supertokens/third-party-email-password-react-oidc-provider';
import { useQuery } from '@tanstack/react-query';

export function AuthOIDCPage(props: { oidcId: string | undefined; redirectToPath: string }) {
  const oidcId = props.oidcId;
  const auth = useQuery({
    queryKey: ['oidc', oidcId],
    enabled: typeof oidcId === 'string' && oidcId.length > 0,
    refetchOnWindowFocus: false,
    retryOnMount: false,
    async queryFn() {
      if (!env.auth.oidc) {
        throw new Error('OIDC provider is not configured');
      }

      if (typeof oidcId === 'string') {
        await startAuthFlowForOIDCProvider(oidcId, props.redirectToPath);
      }

      throw new Error('Missing OIDC ID');
    },
  });

  if (!oidcId) {
    return (
      <AuthCard>
        <AuthCardHeader
          title="Missing ID"
          description="You need to provide an OIDC ID to sign in."
        />
        <AuthCardContent>
          <p className="text-muted-foreground">
            <DocsLink href="/management/sso-oidc-provider#login-via-oidc">
              Learn how to login via OIDC
            </DocsLink>
          </p>
        </AuthCardContent>
      </AuthCard>
    );
  }

  if (auth.isError) {
    return (
      <AuthCard>
        <AuthCardHeader title="OIDC Login Flow Failed" description={auth.error.message} />
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthCardHeader
        title="Starting OIDC Login Flow"
        description="You are being redirected to your OIDC provider."
      />
    </AuthCard>
  );
}
