import React from 'react';
import { signOut } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { reset } from '@/lib/mixpanel';
import { useRouter } from 'next/router';

export default function LogOutPage() {
  const router = useRouter();
  React.useEffect(() => {
    signOut().then(() => {
      reset();
      router.replace('/');
    });
  });

  return null;
}
