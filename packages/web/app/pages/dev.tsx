import React from 'react';
import 'twin.macro';
/* eslint-disable import/no-extraneous-dependencies */
import dynamic from 'next/dynamic';
import 'graphiql/graphiql.css';

const GraphiQL = dynamic(() => import('graphiql'), {
  ssr: false,
});

const fetcher = process.browser
  ? // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@graphiql/toolkit').createGraphiQLFetcher({
      url: window.location.origin + '/api/proxy',
    })
  : null;

export default function Dev() {
  return (
    <div tw="mt-20 h-full w-full">
      <GraphiQL fetcher={fetcher} headerEditorEnabled={true} />
      <style jsx global>{`
        .graphiql-container {
          filter: invert(1);
        }
      `}</style>
    </div>
  );
}
