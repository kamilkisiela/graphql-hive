import { createModule } from 'graphql-modules';
import { CdnProvider } from './providers/cdn.provider';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const cdnModule = createModule({
  id: 'cdn',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [CdnProvider],
});
