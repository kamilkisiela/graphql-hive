import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * node ./scripts/filter-log.mjs usage usage-ingestor emails
 *
 * Creates the `dockest-filtered.log` file with logs from the `dockest.log` file but only for the provided services.
 */
const [, , ...services] = process.argv;

const serviceNames = services.map(name => name.replace(/[^a-z]/i, '-'));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, '../dockest.log');
const filteredLogPath = path.resolve(__dirname, '../dockest-filtered.log');
const logLines = fs.readFileSync(logPath, 'utf-8').split('\n');
const filteredLogLines = logLines.filter(line =>
  serviceNames.some(name => line.startsWith(`integration-tests-${name}`)),
);

fs.writeFileSync(filteredLogPath, filteredLogLines.join('\n'));
