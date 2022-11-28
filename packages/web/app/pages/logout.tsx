import React from 'react';
import { signOut } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { useRouter } from 'next/router';

export function getServerSideProps() {
  return {
    props: {},
  };
}

export default function LogOutPage() {
  const router = useRouter();
  React.useEffect(() => {
    void signOut().then(() => {
      void router.replace('/');
    });
  });

  return null;
}
