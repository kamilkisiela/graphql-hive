import { ReactElement, useEffect, useState } from 'react';
import { GraphiQL } from 'graphiql';
import { HiveLogo } from '@/components/v2/icon';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import 'graphiql/graphiql.css';
import { env } from '@/env/frontend';

export default function DevPage(): ReactElement {
  return (
    <div className="mt-20 size-full">
      <style global jsx>{`
        body.graphiql-dark .graphiql-container {
          --color-base: transparent;
          --color-primary: 40, 89%, 60%;
        }
      `}</style>
      <Editor />
    </div>
  );
}

function Editor() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <GraphiQL fetcher={createGraphiQLFetcher({ url: env.graphqlPublicEndpoint })}>
      <GraphiQL.Logo>
        <HiveLogo className="size-6" />
      </GraphiQL.Logo>
    </GraphiQL>
  );
}
