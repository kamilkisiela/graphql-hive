import { createModule } from 'graphql-modules';
import { traceAsyncFunctionResolvers } from '../../shared/sentry';
import { Inspector } from './providers/inspector';
import { models } from './providers/models';
import { orchestrators } from './providers/orchestrators';
import { RegistryChecks } from './providers/registry-checks';
import { SchemaHelper } from './providers/schema-helper';
import { SchemaManager } from './providers/schema-manager';
import { SchemaPublisher } from './providers/schema-publisher';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const schemaModule = createModule({
  id: 'schema',
  dirname: __dirname,
  typeDefs,
  resolvers: traceAsyncFunctionResolvers(resolvers),
  providers: [
    SchemaManager,
    SchemaPublisher,
    Inspector,
    SchemaHelper,
    RegistryChecks,
    ...orchestrators,
    ...models,
  ],
});
