import { exec } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ci from 'env-ci';
import { processCwd, processEnv } from './process';

interface CIRunner {
  detect(): boolean;
  env(): { commit: string | undefined | null };
}

const splitBy = '<##>';
const gitLogFormat = [
  /* full hash */ '%H',
  /* Author's name */ '%an',
  /* Author's email */ '%ae',
].join(splitBy);
const latestCommitCommand = `git log -1 --pretty=format:"${gitLogFormat}"`;

function getLatestCommitFromGit() {
  return new Promise<{
    hash: string;
    author: string;
  } | null>(resolve => {
    exec(latestCommitCommand, { cwd: processCwd }, (_, stdout) => {
      if (stdout.includes(splitBy)) {
        const [hash, authorName, authorEmail] = stdout.split(splitBy);
        if (hash && authorName) {
          let author = authorName;

          if (authorEmail) {
            author += ` <${authorEmail}>`;
          }

          resolve({
            hash,
            author,
          });
          return;
        }
      }

      resolve(null);
    });
  });
}

function useGitHubAction(): CIRunner {
  return {
    detect() {
      // eslint-disable-next-line no-process-env
      return !!processEnv['GITHUB_ACTIONS'];
    },
    env() {
      const isPr =
        // eslint-disable-next-line no-process-env
        processEnv['GITHUB_EVENT_NAME'] === 'pull_request' ||
        // eslint-disable-next-line no-process-env
        processEnv['GITHUB_EVENT_NAME'] === 'pull_request_target';

      if (isPr) {
        try {
          // eslint-disable-next-line no-process-env
          const event = processEnv['GITHUB_EVENT_PATH']
            ? // eslint-disable-next-line no-process-env
              JSON.parse(readFileSync(processEnv['GITHUB_EVENT_PATH'], 'utf-8'))
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
    const git = await getLatestCommitFromGit();
    if (git) {
      if (!commit) {
        commit = git.hash;
      }

      if (!author) {
        author = git.author;
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
