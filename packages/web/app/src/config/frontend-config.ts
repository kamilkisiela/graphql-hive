import ThirdPartyEmailPasswordReact from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import SessionReact from 'supertokens-auth-react/recipe/session';
import Provider from 'supertokens-auth-react/lib/build/recipe/thirdparty/providers';

import { appInfo } from './app-info';

export const frontendConfig = () => {
  const providers: Array<Provider> = [];

  if (globalThis['__ENV__']?.['AUTH_GITHUB'] === '1') {
    providers.push(ThirdPartyEmailPasswordReact.Github.init());
  }
  if (globalThis['__ENV__']?.['AUTH_GOOGLE'] === '1') {
    providers.push(ThirdPartyEmailPasswordReact.Google.init());
  }

  return {
    appInfo: appInfo(),
    recipeList: [
      ThirdPartyEmailPasswordReact.init({
        signInAndUpFeature: {
          providers,
        },
        emailVerificationFeature: {
          mode: 'REQUIRED',
        },
      }),
      SessionReact.init(),
    ],
  };
};
