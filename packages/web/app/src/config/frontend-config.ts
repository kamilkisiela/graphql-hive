import ThirdPartyEmailPasswordReact from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import SessionReact from 'supertokens-auth-react/recipe/session';
import Provider from 'supertokens-auth-react/lib/build/recipe/thirdparty/providers';

import { appInfo } from './app-info';

export const frontendConfig = () => {
  const providers: Array<Provider> = [];

  if (process.env['NEXT_PUBLIC_AUTH_GITHUB'] === '1') {
    providers.push(ThirdPartyEmailPasswordReact.Github.init());
  }
  if (process.env['NEXT_PUBLIC_AUTH_GOOGLE'] === '1') {
    providers.push(ThirdPartyEmailPasswordReact.Google.init());
  }

  return {
    appInfo,
    recipeList: [
      ThirdPartyEmailPasswordReact.init({
        signInAndUpFeature: {
          providers,
        },
      }),
      SessionReact.init(),
    ],
  };
};
