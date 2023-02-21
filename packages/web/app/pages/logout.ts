import React from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';

export function getServerSideProps() {
  return {
    props: {},
  };
}

export default function LogOutPage() {
  const router = useRouter();
  React.useEffect(() => {
    void signOut().then(() => {
      console.log('Signed out successfully. Redirecting to home page...');
      void router.replace('/');
    });
  });

  return null;
}
