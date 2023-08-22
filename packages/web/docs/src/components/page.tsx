import { ReactElement, ReactNode, useCallback, useState } from 'react';
import Head from 'next/head';
import { useMounted } from '@theguild/components';

const CookiesConsent = (): ReactElement => {
  const [show, setShow] = useState(() => localStorage.getItem('cookies') !== 'true');

  const accept = useCallback(() => {
    setShow(false);
    localStorage.setItem('cookies', 'true');
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-0 flex w-full flex-wrap items-center justify-center gap-4 bg-gray-100 px-5 py-7 text-center lg:flex-nowrap lg:justify-between lg:text-left">
      <div className="w-full text-sm">
        <p>This website uses cookies to analyze site usage and improve your experience.</p>
        <p>If you continue to use our services, you are agreeing to the use of such cookies.</p>
      </div>
      <div className="flex shrink-0 items-center gap-4 lg:pr-24">
        <a
          href="https://the-guild.dev/graphql/hive/privacy-policy.pdf"
          className="whitespace-nowrap text-yellow-600 hover:underline"
        >
          Privacy Policy
        </a>
        <button
          className="rounded-md bg-yellow-500 px-5 py-2 text-white hover:bg-yellow-700 focus:outline-none"
          onClick={accept}
        >
          Allow Cookies
        </button>
      </div>
    </div>
  );
};

export function Page(props: { children: ReactNode }) {
  const mounted = useMounted();

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </Head>
      <div className="flex h-full flex-col font-display">{props.children}</div>
      {mounted && <CookiesConsent />}
    </>
  );
}
