import { AuthCard } from '@/components/auth';
import { Meta } from '@/components/ui/meta';
import { type ThirdPartyProvider } from '@/lib/auth/api';
import { completeThirdPartyAuth } from '@/lib/auth/third-party';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

const providerDetailsMap: {
  [key in ThirdPartyProvider]: {
    name: string;
    failure: string;
    success: string;
  };
} = {
  github: {
    name: 'Github',
    failure: 'Github Authentication Failed',
    success: 'Continuing Github Authentication',
  },
  google: {
    name: 'Google',
    failure: 'Google Authentication Failed',
    success: 'Continuing Google Authentication',
  },
  okta: {
    name: 'Okta',
    failure: 'Okta Authentication Failed',
    success: 'Continuing Okta Authentication',
  },
  oidc: {
    name: 'OIDC',
    failure: 'OIDC Authentication Failed',
    success: 'Continuing OIDC Authentication',
  },
};

function AuthCallback(props: { provider: ThirdPartyProvider }) {
  const router = useRouter();
  const auth = useQuery({
    gcTime: 0, // disabled caching
    queryKey: ['auth-callback', props.provider], // this is a unique key, but we don't use it really as cache is disabled (see gcTime)
    refetchOnWindowFocus: false,
    retryOnMount: false,
    // The server accepts the callback's state once; a retry could only fail.
    retry: false,
    queryFn() {
      return completeThirdPartyAuth(props.provider);
    },
  });
  const providerDetails = providerDetailsMap[props.provider];

  if (auth.isError) {
    return <AuthCard title={providerDetails.failure} description={auth.error.message} />;
  }

  if (auth.isSuccess) {
    if (auth.data.status === 'OK') {
      void router.navigate({
        to: auth.data.redirectToPath,
      });
    } else {
      return <AuthCard title={providerDetails.failure} description={auth.data.reason} />;
    }
  }

  return (
    <AuthCard
      title={providerDetails.success}
      description="You are being redirected to Hive Console."
    />
  );
}

export function AuthCallbackPage(props: { provider: ThirdPartyProvider }) {
  return (
    <>
      <Meta title="Redirecting" />
      <AuthCallback provider={props.provider} />
    </>
  );
}
