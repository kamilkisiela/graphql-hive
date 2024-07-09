import { createConnection } from '../../shared/schema';
import type { TargetModule } from './__generated__/types';
import { TargetManager } from './providers/target-manager';

export const resolvers: TargetModule.Resolvers = {
  Project: {
    targets(project, _, { injector }) {
      return injector.get(TargetManager).getTargets({
        project: project.id,
        organization: project.orgId,
      });
    },
  },
  TargetConnection: createConnection(),
};
