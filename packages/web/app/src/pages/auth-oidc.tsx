import { AuthCard, AuthCardContent, AuthCardHeader } from '@/components/auth';
import { Meta } from '@/components/ui/meta';
import { DocsLink } from '@/components/v2';
import { env } from '@/env/frontend';
import { startAuthFlowForOIDCProvider } from '@/lib/supertokens/third-party-email-password-react-oidc-provider';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from '@tanstack/react-router';

function AuthOIDC(props: { oidcId: string; redirectToPath: string }) {
  const auth = useQuery({
    queryKey: ['oidc', props.oidcId],
    refetchOnWindowFocus: false,
    retryOnMount: false,
    async queryFn() {
      if (!env.auth.oidc) {
        throw new Error('OIDC provider is not configured');
      }

      await startAuthFlowForOIDCProvider(props.oidcId);
    },
  });

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

function MissingOIDCId() {
  return (
    <AuthCard>
      <AuthCardHeader title="Missing ID" description="You need to provide an OIDC ID to sign in." />
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

export function AuthOIDCPage(props: {
  oidcId: string | undefined;
  redirectToPath: string;
  isCallback: boolean;
}) {
  const oidcId = props.oidcId;
  const isCallback = props.isCallback;

  return (
    <>
      <Meta title="OIDC Login" />
      {oidcId ? (
        isCallback ? (
          <Navigate
            to="/auth/callback/$provider"
            params={{
              provider: 'oidc',
            }}
            search={search => ({
              ...search,
              redirectToPath: props.redirectToPath,
            })}
          />
        ) : (
          <AuthOIDC oidcId={oidcId} redirectToPath={props.redirectToPath} />
        )
      ) : (
        <MissingOIDCId />
      )}
    </>
  );
}
