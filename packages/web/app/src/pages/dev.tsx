import { GraphiQL } from 'graphiql';
import { HiveLogo } from '@/components/v2/icon';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import 'graphiql/graphiql.css';
import { Helmet } from 'react-helmet';
import { env } from '@/env/frontend';

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
