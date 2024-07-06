import { createConnection } from '../../shared/schema';
import { AuthModule } from './__generated__/types';

export const resolvers: AuthModule.Resolvers = {
  MemberConnection: createConnection(),
};
