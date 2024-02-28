import { ReactElement } from 'react';
import { GraphiQL } from 'graphiql';
import { HiveLogo } from '@/components/v2/icon';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import 'graphiql/graphiql.css';

export default function DevPage(): ReactElement {
  return (
    <div className="mt-20 size-full">
      <style global jsx>{`
        body.graphiql-dark .graphiql-container {
          --color-base: transparent;
          --color-primary: 40, 89%, 60%;
        }
      `}</style>
      {process.browser && (
        <GraphiQL fetcher={createGraphiQLFetcher({ url: `${location.origin}/api/proxy` })}>
          <GraphiQL.Logo>
            <HiveLogo className="size-6" />
          </GraphiQL.Logo>
        </GraphiQL>
      )}
    </div>
  );
}
