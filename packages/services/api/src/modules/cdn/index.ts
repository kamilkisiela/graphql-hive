import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { CdnProvider } from './providers/cdn.provider';
import { resolvers } from './resolvers';

export const cdnModule = createModule({
  id: 'cdn',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [CdnProvider],
});
