import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { ProjectManager } from './providers/project-manager';
import { resolvers } from './resolvers';

export const projectModule = createModule({
  id: 'project',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [ProjectManager],
});
