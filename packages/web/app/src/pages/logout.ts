import { useEffect } from 'react';
import { signOut } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { useRouter } from '@tanstack/react-router';

export function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    void signOut().then(() => {
      void router.navigate({
        to: '/',
      });
    });
  });

  return null;
}
