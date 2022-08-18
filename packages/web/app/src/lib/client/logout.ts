import { signOut } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { reset } from '../mixpanel';

export const logOut = async (): Promise<void> => {
  await signOut();
  reset();
  window.location.href = '/';
};
