import { UserInput } from 'supertokens-auth-react/lib/build/recipe/thirdpartyemailpassword/types';
import { getAuthorisationURLWithQueryParamsAndSetState } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { env } from '@/env/frontend';

export const createThirdPartyEmailPasswordReactOIDCProvider = () => ({
  id: 'oidc',
  name: 'OIDC',
});

const delimiter = '--';

export const getOIDCOverrides = (): UserInput['override'] => ({
  functions: originalImplementation => ({
    ...originalImplementation,
    generateStateToSendToOAuthProvider(input) {
      const hash = originalImplementation.generateStateToSendToOAuthProvider(input);
      const oidcId = input?.userContext?.['oidcId'];

      if (typeof oidcId === 'string') {
        return `${hash}${delimiter}${oidcId}`;
      }

      return hash;
    },
    getAuthorisationURLFromBackend(input) {
      const maybeId: unknown = input.userContext['oidcId'];

      return originalImplementation.getAuthorisationURLFromBackend(
        typeof maybeId === 'string'
          ? {
              ...input,
              options: {
                preAPIHook: async options => {
                  const url = new URL(options.url);
                  url.searchParams.append('oidc_id', maybeId);
                  return {
                    ...options,
                    url: url.toString(),
                  };
                },
              },
            }
          : input,
      );
    },
    thirdPartySignInAndUp(input) {
      const locationUrl = new URL(window.location.toString());
      // TODO: maybe there is a better way than getting the state from the URL
      const [, oidcId] = locationUrl.searchParams.get('state')?.split(delimiter) ?? [];

      return originalImplementation.thirdPartySignInAndUp(
        typeof oidcId === 'string'
          ? {
              ...input,
              options: {
                preAPIHook: async options => {
                  const url = new URL(options.url);
                  url.searchParams.append('oidc_id', oidcId);
                  return {
                    ...options,
                    url: url.toString(),
                  };
                },
              },
            }
          : input,
      );
    },
  }),
});

export const startAuthFlowForOIDCProvider = async (oidcId: string) => {
  const authUrl = await getAuthorisationURLWithQueryParamsAndSetState({
    thirdPartyId: 'oidc',
    frontendRedirectURI: `${env.appBaseUrl}/auth/callback/oidc`,
    // The user context is very important - we store the OIDC ID so we can use it later on.
    userContext: {
      oidcId,
    },
  });

  window.location.assign(authUrl);
};
