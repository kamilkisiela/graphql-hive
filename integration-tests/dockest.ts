import { Dockest, logLevel } from 'dockest';
import { cleanDockerContainers, createServices } from './testkit/dockest';
import dotenv from 'dotenv';

async function main() {
  dotenv.config();

  const dockest = new Dockest({
    logLevel: logLevel.DEBUG,
    jestOpts: {
      runInBand: true,
      testMatch: process.env.TEST_FILTER
        ? [`**/${process.env.TEST_FILTER}?(*.)+(spec|test).[jt]s?(x)`]
        : undefined,
      config: JSON.stringify({
        roots: ['<rootDir>/tests'],
        transform: {
          '^.+\\.ts$': 'ts-jest',
        },
        testTimeout: 60_000,
        maxConcurrency: 1,
        setupFiles: ['dotenv/config'],
        setupFilesAfterEnv: ['./jest-setup.ts'],
      }),
    },
  });

  cleanDockerContainers();

  return dockest.run(createServices());
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
