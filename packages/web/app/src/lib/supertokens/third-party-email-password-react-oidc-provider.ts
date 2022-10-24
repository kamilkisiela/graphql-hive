import { UserInput } from 'supertokens-auth-react/lib/build/recipe/thirdpartyemailpassword/types';

export const createThirdPartyEmailPasswordReactOIDCProvider = () => ({
  id: 'oidc',
  name: 'OIDC',
});

export const getOIDCOverrides = (): UserInput['override'] => ({
  functions: originalImplementation => ({
    ...originalImplementation,
    generateStateToSendToOAuthProvider(input) {
      if (typeof input.userContext['oidcId'] === 'string') {
        // TODO: This should probably also contain a part that is uniquely generated
        return input.userContext['oidcId'] as string;
      }

      return originalImplementation.generateStateToSendToOAuthProvider(input);
    },
    // TODO: this does not work as expected - `preAPIHook` is not called
    // getAuthorisationURLFromBackend(input) {
    //   const maybeId: unknown = input.userContext['oidcId'];

    //   if (typeof maybeId === 'string') {
    //     return originalImplementation.getAuthorisationURLFromBackend({
    //       ...input,
    //       options: {
    //         preAPIHook: async options => {
    //           alert('NANI');

    //           return {
    //             ...options,
    //             url: url.toString(),
    //           };
    //         },
    //       },
    //     });
    //   }
    //   return originalImplementation.getAuthorisationURLFromBackend(input);
    // },
  }),
});
