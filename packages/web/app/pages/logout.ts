import React from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';

export default function LogOutPage() {
  const router = useRouter();
  React.useEffect(() => {
    void signOut().then(() => {
      void router.replace('/');
    });
  });

  return null;
}
