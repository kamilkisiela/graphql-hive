import { createModule } from 'graphql-modules';
import { BreakingSchemaChangeUsageHelper } from './providers/breaking-schema-changes-helper';
import { Contracts } from './providers/contracts';
import { ContractsManager } from './providers/contracts-manager';
import { Inspector } from './providers/inspector';
import { models } from './providers/models';
import { orchestrators } from './providers/orchestrators';
import { RegistryChecks } from './providers/registry-checks';
import { SchemaCheckManager } from './providers/schema-check-manager';
import { SchemaHelper } from './providers/schema-helper';
import { SchemaManager } from './providers/schema-manager';
import { SchemaPublisher } from './providers/schema-publisher';
import { SchemaVersionHelper } from './providers/schema-version-helper';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const schemaModule = createModule({
  id: 'schema',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [
    SchemaManager,
    SchemaPublisher,
    Inspector,
    SchemaHelper,
    RegistryChecks,
    SchemaVersionHelper,
    Contracts,
    ContractsManager,
    SchemaCheckManager,
    BreakingSchemaChangeUsageHelper,
    ...orchestrators,
    ...models,
  ],
});
