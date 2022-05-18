import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers';
import { ProjectManager } from './providers/project-manager';
import typeDefs from './module.graphql';

export const projectModule = createModule({
  id: 'project',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [ProjectManager],
});
