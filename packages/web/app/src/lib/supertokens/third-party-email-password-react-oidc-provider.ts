import { env } from '@/env/frontend';
import { RecipePreAPIHookFunction } from 'supertokens-auth-react/lib/build/recipe/recipeModule/types';
import {
  PreAndPostAPIHookAction,
  UserInput,
} from 'supertokens-auth-react/lib/build/recipe/thirdpartyemailpassword/types';
import { getAuthorisationURLWithQueryParamsAndSetState } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';

export const createThirdPartyEmailPasswordReactOIDCProvider = () => ({
  id: 'oidc',
  name: 'OIDC',
});

const delimiter = '||';

export const getOIDCOverrides = (): UserInput['override'] => ({
  functions: originalImplementation => ({
    ...originalImplementation,
    generateStateToSendToOAuthProvider(input) {
      const hash = originalImplementation.generateStateToSendToOAuthProvider(input);
      const oidcId: unknown = input.userContext['oidcId'];

      if (typeof oidcId === 'string') {
        return `${hash}${delimiter}${oidcId}`;
      }

      return hash;
    },
  }),
});

export const preAPIHook: RecipePreAPIHookFunction<PreAndPostAPIHookAction> = async options => {
  if (options.action === 'GET_AUTHORISATION_URL') {
    const maybeId: unknown = options.userContext['oidcId'];
    if (typeof maybeId === 'string') {
      const url = new URL(options.url);
      url.searchParams.append('oidc_id', maybeId);
      return {
        ...options,
        url: url.toString(),
      };
    }
  }

  /**
   * In the callback the oidc_id is within the state parameter.
   */
  if (options.action === 'THIRD_PARTY_SIGN_IN_UP') {
    const locationUrl = new URL(window.location.toString());
    const url = new URL(options.url);
    const [, oidcId] = locationUrl.searchParams.get('state')?.split('||') ?? [];
    if (oidcId) {
      url.searchParams.append('oidc_id', oidcId);
    }

    return {
      ...options,
      url: url.toString(),
    };
  }

  return options;
};

export const startAuthFlowForOIDCProvider = async (oidcId: string) => {
  const authUrl = await getAuthorisationURLWithQueryParamsAndSetState({
    providerId: 'oidc',
    authorisationURL: `${env.appBaseUrl}/auth/callback/oidc`,
    // The user context is very important - we store the OIDC ID so we can use it later on.
    userContext: {
      oidcId,
    },
  });

  window.location.assign(authUrl);
};
