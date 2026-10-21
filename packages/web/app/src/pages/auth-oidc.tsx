import { AuthCard } from '@/components/auth';
import { DocsLink } from '@/components/ui/docs-note';
import { Meta } from '@/components/ui/meta';
import { startThirdPartyAuth } from '@/lib/auth/third-party';
import { useQuery } from '@tanstack/react-query';

function AuthOIDC(props: { oidcId: string; redirectToPath: string }) {
  const auth = useQuery({
    queryKey: ['oidc', props.oidcId],
    refetchOnWindowFocus: false,
    retry: false,
    retryOnMount: false,
    async queryFn() {
      await startThirdPartyAuth('oidc', props.redirectToPath, props.oidcId);
      // we need to return something, otherwise react-query will throw an error
      return true;
    },
  });

  if (auth.isError) {
    return <AuthCard title="OIDC Login Flow Failed" description={auth.error.message} />;
  }

  return (
    <AuthCard
      title="Starting OIDC Login Flow"
      description="You are being redirected to your OIDC provider."
    />
  );
}

function MissingOIDCId() {
  return (
    <AuthCard
      title="Missing ID"
      description="You need to provide an OIDC ID to sign in."
      content={
        <p className="text-fg-secondary">
          <DocsLink
            href="/management/sso-oidc-provider#login-via-oidc"
            text="Learn how to login via OIDC"
          />
        </p>
      }
    />
  );
}

export function AuthOIDCPage(props: { oidcId: string | undefined; redirectToPath: string }) {
  const oidcId = props.oidcId;

  return (
    <>
      <Meta title="OIDC Login" />
      {oidcId ? (
        <AuthOIDC oidcId={oidcId} redirectToPath={props.redirectToPath} />
      ) : (
        <MissingOIDCId />
      )}
    </>
  );
}
