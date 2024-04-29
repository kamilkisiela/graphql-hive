import React from 'react';
import { signOut } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { useRouter } from '@/lib/hooks/use-route-selector';

export default function LogOutPage() {
  const router = useRouter();
  React.useEffect(() => {
    void signOut().then(() => {
      void router.replace('/');
    });
  });

  return null;
}
