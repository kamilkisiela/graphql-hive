import ThirdPartyEmailPasswordReact from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import EmailVerification from 'supertokens-auth-react/recipe/emailverification';
import SessionReact from 'supertokens-auth-react/recipe/session';
import Provider from 'supertokens-auth-react/lib/build/recipe/thirdparty/providers';
import { env } from '@/env/frontend';
import { appInfo } from '../../lib/supertokens/app-info';
import { CustomProviderConfig } from 'supertokens-auth-react/lib/build/recipe/thirdparty/providers/types';
import { createThirdPartyEmailPasswordReactOktaProvider } from '../../lib/supertokens/third-party-email-password-react-okta-provider';

export const frontendConfig = () => {
  const providers: Array<Provider | CustomProviderConfig> = [];

  if (env.auth.github === true) {
    providers.push(ThirdPartyEmailPasswordReact.Github.init());
  }
  if (env.auth.google === true) {
    providers.push(ThirdPartyEmailPasswordReact.Google.init());
  }

  if (env.auth.okta !== null) {
    if (
      env.auth.okta.hidden === false ||
      globalThis.window?.location.pathname === '/auth/callback/okta' ||
      // Until we support the Okta Integration Network (OIN)
      // We want to hide the log in with Okta button on the hosted platform by default to not confuse people
      // We only wnat to show it conditionally in order to verify the integration is working for the OIN application process.
      (env.auth.okta.hidden === true &&
        // Only show Okta via query parameter
        new URLSearchParams(globalThis.window?.location.search ?? '').get('show_okta') === '1')
    ) {
      providers.push(createThirdPartyEmailPasswordReactOktaProvider());
    }
  }

  return {
    appInfo: appInfo(),
    recipeList: [
      ThirdPartyEmailPasswordReact.init({
        signInAndUpFeature: {
          providers,
        },
      }),
      EmailVerification.init({
        mode: env.auth.requireEmailVerification ? 'REQUIRED' : 'OPTIONAL',
      }),
      SessionReact.init(),
    ],
  };
};
