import { createConnection } from '../../shared/schema';
import type { ProjectModule } from './__generated__/types';

export const resolvers: ProjectModule.Resolvers = {
  ProjectConnection: createConnection(),
};
