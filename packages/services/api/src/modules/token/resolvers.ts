import { createConnection } from '../../shared/schema';
import type { TokenModule } from './__generated__/types';

export const resolvers: TokenModule.Resolvers = {
  TokenConnection: createConnection(),
};
