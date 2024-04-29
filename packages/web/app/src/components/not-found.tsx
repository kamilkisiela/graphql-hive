import ghost from '../../public/images/figures/ghost.svg?url';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { captureMessage } from '@sentry/react';
import { useRouter } from '@tanstack/react-router';

export function NotFound() {
  const router = useRouter();

  captureMessage('404 Not Found', {
    level: 'warning',
    extra: {
      href1: router.history.location.href,
      href2: window.location.href,
      href3: router.latestLocation.href,
    },
  });

  return (
    <>
      <div className="flex h-screen flex-col items-center justify-center gap-2.5">
        <img src={ghost} alt="Ghost illustration" width="200" height="200" className="drag-none" />
        <h2 className="text-5xl font-bold">404</h2>
        <h3 className="text-xl font-semibold">Page Not Found</h3>
        <Button variant="secondary" onClick={router.history.back}>
          Go back
        </Button>

        <Helmet>
          <style key="not-found-styles">
            {`
            html {
              background:
                url(/images/bg-top-shine.svg) no-repeat left top,
                url(/images/bg-bottom-shine.svg) no-repeat right bottom,
                #0b0d11;
            }

            body {
              background: transparent !important;
              color: #fcfcfc !important;
            }
          `}
          </style>
        </Helmet>
      </div>
    </>
  );
}
