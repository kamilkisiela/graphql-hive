import { TargetManager } from '../providers/target-manager';
import type { ProjectResolvers } from './../../../__generated__/types.next';

export const Project: Pick<ProjectResolvers, 'targets' | '__isTypeOf'> = {
  targets: (project, _, { injector }) => {
    return injector.get(TargetManager).getTargets({
      project: project.id,
      organization: project.orgId,
    });
  },
};
