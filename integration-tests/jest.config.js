import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { pathsToModuleNameMapper } from 'ts-jest';

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const TSCONFIG = resolve(ROOT_DIR, 'tsconfig.json');
const tsconfig = JSON.parse(readFileSync(TSCONFIG, 'utf-8'));

export default {
  preset: 'ts-jest',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  rootDir: ROOT_DIR,
  restoreMocks: true,
  reporters: ['default'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
      prefix: `${ROOT_DIR}/`,
    }),
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 30_000,
  setupFilesAfterEnv: ['dotenv/config'],
  collectCoverage: false,
};
