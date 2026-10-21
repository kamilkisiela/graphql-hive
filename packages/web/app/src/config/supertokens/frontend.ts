import SessionReact from 'supertokens-auth-react/recipe/session';
import { appInfo } from '@/lib/supertokens/app-info';

// Only the session recipe is left: it keeps writing the same `sFrontToken` cookie the in-app
// store reads until the SDK is removed.
export const frontendConfig = () => ({
  appInfo: appInfo(),
  recipeList: [SessionReact.init({})],
});
