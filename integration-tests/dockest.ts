import { Dockest, logLevel } from 'dockest';
import { cleanDockerContainers, createServices } from './testkit/dockest';
import dotenv from 'dotenv';

async function main() {
  dotenv.config();

  const dockest = new Dockest({
    logLevel: logLevel.DEBUG,
    jestOpts: {
      runInBand: true,
      config: JSON.stringify({
        roots: ['<rootDir>/tests'],
        transform: {
          '^.+\\.ts$': 'ts-jest',
        },
        testTimeout: 45_000,
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
