/**
 * Seems like the cache of turborepo is just growing and growing.
 *
 * Location: ./node_modules/.cache/turbo
 *
 * The goal here is to delete it once a week.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rimraf from 'rimraf';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const cacheDir = path.join('node_modules', '.cache', 'turbo');
const cleanupDateFile = path.resolve(cwd, cacheDir, 'last-cleanup.txt');

function main() {
  const lastCleanupDate = fs.existsSync(cleanupDateFile)
    ? parseInt(fs.readFileSync(cleanupDateFile, 'utf-8').trim(), 10)
    : null;

  const dayInMilliseconds = 1000 * 60 * 60 * 24;
  const oneWeekAgo = Date.now() - 7 * dayInMilliseconds;

  if (lastCleanupDate && lastCleanupDate > oneWeekAgo) {
    console.log('[turborepo-cleanup] Cache is not old enough. Skipping.');
    return;
  }

  if (!lastCleanupDate) {
    console.log('[turborepo-cleanup] No cleanup date found.');
  }

  console.log('[turborepo-cleanup] Cleaning up the cache.');

  rimraf.sync(path.resolve(cwd, cacheDir));
  fs.mkdirSync(path.resolve(cwd, cacheDir), { recursive: true });
  fs.writeFileSync(cleanupDateFile, Date.now().toString(), 'utf-8');
}

main();
