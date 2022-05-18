import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { pathsToModuleNameMapper } from 'ts-jest';

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const TSCONFIG = resolve(ROOT_DIR, 'tsconfig.json');
const tsconfig = JSON.parse(readFileSync(TSCONFIG, 'utf-8'));

export default {
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'node',
  rootDir: ROOT_DIR,
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: TSCONFIG,
      useESM: true,
    },
  },
  restoreMocks: true,
  reporters: ['default'],
  modulePathIgnorePatterns: ['dist', 'integration-tests', 'tmp'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
      prefix: `${ROOT_DIR}/`,
    }),
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: [],
  collectCoverage: false,
};
