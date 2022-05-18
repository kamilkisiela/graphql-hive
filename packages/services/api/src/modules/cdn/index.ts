import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';
import { CdnProvider } from './providers/cdn.provider';

export const cdnModule = createModule({
  id: 'cdn',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [CdnProvider],
});
