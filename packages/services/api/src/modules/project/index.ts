import { createModule } from 'graphql-modules';
import { ProjectManager } from './providers/project-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const projectModule = createModule({
  id: 'project',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [ProjectManager],
});
