import { exec } from 'child_process';
import { readFileSync } from 'fs';
import ci from 'env-ci';

interface CIRunner {
  detect(): boolean;
  env(): {
    commit: string | undefined | null;
    pullRequestNumber: string | undefined | null;
    repository: string | undefined | null;
  };
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
    exec(latestCommitCommand, { cwd: process.cwd() }, (_, stdout) => {
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
              pullRequestNumber: String(event.pull_request.number),
              // eslint-disable-next-line no-process-env
              repository: process.env['GITHUB_REPOSITORY']!,
            };
          }
        } catch {
          // Noop
        }
      }

      return { commit: undefined, pullRequestNumber: undefined, repository: undefined };
    },
  };
}

export type GitInfo = {
  repository: string | null;
  pullRequestNumber: string | null;
  commit: string | null;
  author: string | null;
};

export async function gitInfo(noGit: () => void): Promise<GitInfo> {
  let repository: string | null = null;
  let pullRequestNumber: string | null = null;
  let commit: string | null = null;
  let author: string | null = null;

  const env = ci();

  const githubAction = useGitHubAction();

  if (githubAction.detect()) {
    const env = githubAction.env();
    repository = env.repository ?? null;
    commit = env.commit ?? null;
    pullRequestNumber = env.pullRequestNumber ?? null;
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
    repository,
    pullRequestNumber,
    commit,
    author,
  };
}
