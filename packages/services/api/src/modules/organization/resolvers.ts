import { createConnection } from '../../shared/schema';
import type { OrganizationModule } from './__generated__/types';

export const resolvers: OrganizationModule.Resolvers = {
  OrganizationConnection: createConnection(),
};
