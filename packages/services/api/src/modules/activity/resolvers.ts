import { createConnection } from '../../shared/schema';
import { ActivityModule } from './__generated__/types';

export const resolvers: ActivityModule.Resolvers = {
  ActivityConnection: createConnection(),
};
