import { CustomProviderConfig } from 'supertokens-auth-react/lib/build/recipe/thirdparty/providers/types';

export const createThirdPartyEmailPasswordReactOktaProvider = (): CustomProviderConfig => ({
  id: 'okta',
  name: 'Okta',
  buttonComponent: (
    <div
      style={{
        cursor: 'pointer',
        border: '1',
        paddingTop: '5px',
        paddingBottom: '5px',
        borderRadius: '5px',
        borderStyle: 'solid',
        background: '#00297A',
      }}
    >
      Login with Okta
    </div>
  ),
});
