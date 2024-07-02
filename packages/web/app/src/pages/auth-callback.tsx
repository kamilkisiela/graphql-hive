import { thirdPartySignInAndUp } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { AuthCard, AuthCardHeader } from '@/components/auth';
import { env } from '@/env/frontend';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

type Provider = 'github' | 'google' | 'okta' | 'oidc';

const providerDetailsMap: {
  [key in Provider]: {
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

export function AuthCallbackPage(props: { provider: Provider; redirectToPath: string }) {
  const router = useRouter();
  const auth = useQuery({
    gcTime: 0, // disabled caching
    queryKey: ['auth-callback', props.provider], // this is a unique key, but we don't use it really as cache is disabled (see gcTime)
    refetchOnWindowFocus: false,
    retryOnMount: false,
    queryFn() {
      const provider = props.provider;
      if (!env.auth[provider]) {
        throw new Error(`Provider for ${provider} is not configured`);
      }

      return thirdPartySignInAndUp();
    },
  });
  const providerDetails = providerDetailsMap[props.provider];

  if (auth.isError) {
    return (
      <AuthCard>
        <AuthCardHeader title={providerDetails.failure} description={auth.error.message} />
      </AuthCard>
    );
  }

  if (auth.isSuccess) {
    if (auth.data.status === 'OK') {
      void router.navigate({
        to: props.redirectToPath,
      });
    } else {
      return (
        <AuthCard>
          <AuthCardHeader
            title={providerDetails.failure}
            description={
              auth.data.status === 'NO_EMAIL_GIVEN_BY_PROVIDER'
                ? 'No email address was provided by the auth provider. Please try again.'
                : 'Sign in not allowed.'
            }
          />
        </AuthCard>
      );
    }
  }

  return (
    <AuthCard>
      <AuthCardHeader
        title={providerDetails.success}
        description="Your are being redirected to GraphQL Hive."
      />
    </AuthCard>
  );
}
