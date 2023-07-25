import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setOutput } from '@actions/core';

const GITHUB_REPOSITORY = ensureEnv('GITHUB_REPOSITORY');

const [localVersion, latestStableVersion] = await Promise.all([
  fetchLocalVersion(),
  fetchLatestVersion(),
]);

console.log(`Latest stable version: ${latestStableVersion}`);
console.log(`Local version: ${localVersion}`);

if (localVersion === latestStableVersion) {
  console.log('Local version is up to date');
  setOutput('update', 'false');
  process.exit(0);
}

console.log('Local version is out of date');

if (await isPullRequestOpen(latestStableVersion)) {
  console.log(`PR already exists`);
  setOutput('update', 'false');
} else {
  console.log('PR does not exist.');
  console.log(`Run: cargo update -p apollo-router --precise ${latestStableVersion}`);
  console.log('Then commit and push the changes.');
  setOutput('update', 'true');
  setOutput('version', latestStableVersion);
}

function ensureEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }

  return value;
}

async function fetchLatestVersion() {
  const versionsResponse = await fetch('https://crates.io/api/v1/crates/apollo-router/versions', {
    method: 'GET',
  });

  if (!versionsResponse.ok) {
    throw new Error('Failed to fetch versions');
  }

  const { versions } = await versionsResponse.json();

  let latestStableVersion: string | undefined;
  const stableRegex = /^(\d+\.\d+\.\d+)$/;

  for (const version of versions) {
    if (!stableRegex.test(version.num)) {
      continue;
    }

    latestStableVersion = version.num;
    break;
  }

  if (!latestStableVersion) {
    throw new Error('Failed to find latest stable version');
  }

  return latestStableVersion;
}

async function fetchLocalVersion() {
  const lockFile = await readFile(join(process.cwd(), './Cargo.lock'), 'utf-8');

  const apolloRouterPackage = lockFile
    .split('[[package]]')
    .find(pkg => pkg.includes('name = "apollo-router"'));

  if (!apolloRouterPackage) {
    throw new Error('Failed to find apollo-router package in Cargo.lock');
  }

  const versionMatch = apolloRouterPackage.match(/version = "(.*)"/);

  if (!versionMatch) {
    throw new Error('Failed to find version of apollo-router package in Cargo.lock');
  }

  return versionMatch[1];
}

async function isPullRequestOpen(latestStableVersion: string) {
  const prTitle = `Update apollo-router to ${latestStableVersion}`;

  setOutput('title', prTitle);

  const prResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls`);

  if (!prResponse.ok) {
    throw new Error('Failed to fetch PRs');
  }

  const prs: Array<{
    title: string;
    html_url: string;
  }> = await prResponse.json();

  return prs.some(pr => pr.title === prTitle);
}
