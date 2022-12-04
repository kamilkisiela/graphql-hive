import { createModule } from 'graphql-modules';
import { Inspector } from './providers/inspector';
import { orchestrators } from './providers/orchestrators';
import { SchemaHelper } from './providers/schema-helper';
import { SchemaManager } from './providers/schema-manager';
import { SchemaPublisher } from './providers/schema-publisher';
import { SchemaValidator } from './providers/schema-validator';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const schemaModule = createModule({
  id: 'schema',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [
    SchemaManager,
    SchemaValidator,
    SchemaPublisher,
    Inspector,
    SchemaHelper,
    ...orchestrators,
  ],
});
