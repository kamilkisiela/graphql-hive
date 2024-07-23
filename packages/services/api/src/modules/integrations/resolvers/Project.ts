import type { ProjectResolvers } from './../../../__generated__/types.next';

export const Project: Pick<ProjectResolvers, 'isProjectNameInGitHubCheckEnabled'> = {
  isProjectNameInGitHubCheckEnabled: project => {
    return project.useProjectNameInGithubCheck;
  },
};
