import Image from 'next/image';
import Router from 'next/router';
import { Button } from '@/components/v2';
import ghost from '../public/images/figures/ghost.svg';

const NotFoundPage = () => {
  return (
    <>
      <div className="flex h-screen flex-col items-center justify-center gap-2.5">
        <Image
          src={ghost}
          alt="Ghost illustration"
          width="200"
          height="200"
          className="drag-none"
        />
        <h2 className="text-5xl font-bold">404</h2>
        <h3 className="text-xl font-semibold">Page Not Found</h3>
        <Button variant="link" onClick={Router.back}>
          Go back
        </Button>

        <style jsx global>{`
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

          #__next {
            color: inherit;
          }
        `}</style>
      </div>
    </>
  );
};

export default NotFoundPage;
