import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { pathsToModuleNameMapper } from 'ts-jest';

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const TSCONFIG = resolve(ROOT_DIR, 'tsconfig.json');
const tsconfig = JSON.parse(readFileSync(TSCONFIG, 'utf-8'));

export default {
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'node',
  rootDir: ROOT_DIR,
  restoreMocks: true,
  reporters: ['default'],
  modulePathIgnorePatterns: ['dist', 'integration-tests', 'tmp', 'target'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
      prefix: `${ROOT_DIR}/`,
    }),
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: [],
  collectCoverage: false,
};
