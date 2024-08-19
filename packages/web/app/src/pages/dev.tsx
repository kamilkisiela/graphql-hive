import { GraphiQL } from 'graphiql';
import { Helmet } from 'react-helmet-async';
import { HiveLogo } from '@/components/ui/icon';
import { env } from '@/env/frontend';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import 'graphiql/style.css';

export function DevPage() {
  return (
    <div className="size-full">
      <Helmet>
        <style key="dev">
          {`
            body.graphiql-dark .graphiql-container {
              --color-base: transparent;
              --color-primary: 40, 89%, 60%;
            }
          `}
        </style>
      </Helmet>
      <GraphiQL fetcher={createGraphiQLFetcher({ url: env.graphqlPublicEndpoint })}>
        <GraphiQL.Logo>
          <HiveLogo className="size-6" />
        </GraphiQL.Logo>
      </GraphiQL>
    </div>
  );
}
