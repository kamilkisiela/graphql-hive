import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import ci from 'env-ci';
import { gitToJs } from 'git-parse';

function splitPath(path: string) {
  const parts = path.split(/(\/|\\)/);
  if (!parts.length) {
    return parts;
  }

  // when path starts with a slash, the first part is empty string
  return !parts[0].length ? parts.slice(1) : parts;
}

function findParentDir(currentFullPath: string, clue: string) {
  function testDir(parts: string[]): null | string {
    if (parts.length === 0) {
      return null;
    }

    const p = parts.join('');

    const itdoes = existsSync(join(p, clue));
    return itdoes ? p : testDir(parts.slice(0, -1));
  }

  return testDir(splitPath(currentFullPath));
}

interface CIRunner {
  detect(): boolean;
  env(): { commit: string | undefined | null };
}

function useGitHubAction(): CIRunner {
  return {
    detect() {
      // eslint-disable-next-line no-process-env
      return !!process.env.GITHUB_ACTIONS;
    },
    env() {
      const isPr =
        // eslint-disable-next-line no-process-env
        process.env.GITHUB_EVENT_NAME === 'pull_request' ||
        // eslint-disable-next-line no-process-env
        process.env.GITHUB_EVENT_NAME === 'pull_request_target';

      if (isPr) {
        try {
          // eslint-disable-next-line no-process-env
          const event = process.env.GITHUB_EVENT_PATH
            ? // eslint-disable-next-line no-process-env
              JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf-8'))
            : undefined;

          if (event?.pull_request) {
            return {
              commit: event.pull_request.head.sha as string,
            };
          }
        } catch {
          // Noop
        }
      }

      return { commit: undefined };
    },
  };
}

export async function gitInfo(noGit: () => void) {
  let commit: string | null = null;
  let author: string | null = null;

  const env = ci();

  const githubAction = useGitHubAction();

  if (githubAction.detect()) {
    commit = githubAction.env().commit ?? null;
  }

  if (!commit) {
    commit = env.commit ?? null;
  }

  if (!commit || !author) {
    const rootFromEnv = 'root' in env ? env.root : null;
    const git =
      rootFromEnv ?? findParentDir(__dirname, '.git') ?? findParentDir(process.cwd(), '.git');

    if (git) {
      const commits = await gitToJs(git);

      if (commits && commits.length) {
        const lastCommit = commits[0];

        if (!commit) {
          commit = lastCommit.hash;
        }

        if (!author) {
          author = `${lastCommit.authorName || ''} ${
            lastCommit.authorEmail ? `<${lastCommit.authorEmail}>` : ''
          }`.trim();
        }
      }
    } else {
      noGit();
    }
  }

  return {
    commit,
    author,
  };
}
