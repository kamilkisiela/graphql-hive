import { createConnection } from '../../shared/schema';
import type { TargetModule } from './__generated__/types';

export const resolvers: TargetModule.Resolvers = {
  TargetConnection: createConnection(),
};
