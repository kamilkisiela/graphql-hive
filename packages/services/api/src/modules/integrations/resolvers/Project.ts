import type { ProjectResolvers } from './../../../__generated__/types.next';

export const Project: Pick<ProjectResolvers, 'isProjectNameInGitHubCheckEnabled' | '__isTypeOf'> = {
  isProjectNameInGitHubCheckEnabled: project => {
    return project.useProjectNameInGithubCheck;
  },
};
