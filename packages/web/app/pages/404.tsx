import Error from 'next/error';

const NotFoundPage = () => {
  return (
    <>
      <Error statusCode={404} />
      <style jsx global>{`
        html {
          background: #0b0d11;
        }

        body {
          background: transparent !important;
          color: #fcfcfc !important;
        }

        #__next {
          color: inherit;
        }

        .next-error-h1 {
          border-color: #fcfcfc !important;
        }
      `}</style>
    </>
  );
};

export default NotFoundPage;
