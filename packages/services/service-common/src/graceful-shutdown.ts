import type { FastifyBaseLogger } from 'fastify';

const errorTypes = ['unhandledRejection', 'uncaughtException'];
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

export function registerShutdown(config: {
  logger: FastifyBaseLogger;
  onShutdown(): void | Promise<void>;
}): (reason?: string) => Promise<void> {
  let exited = false;

  async function shutdown() {
    if (exited) {
      return;
    }
    config.logger.info('Shutting down...');
    exited = true;
    await config.onShutdown();
  }

  errorTypes.map(type => {
    process.on(type, async e => {
      try {
        config.logger.info(`process.on ${type}`);
        config.logger.error(e);
        await shutdown();
        config.logger.info(`shutdown process done, exiting with code 0`);
        process.exit(0);
      } catch (e) {
        config.logger.warn(`shutdown process failed, exiting with code 1`);
        config.logger.error(e);
        process.exit(1);
      }
    });
  });

  signalTraps.map(type => {
    process.once(type, async () => {
      try {
        config.logger.info(`process.on ${type}`);
        await shutdown();
        config.logger.info(`shutdown process done, exiting with code 0`);
        process.exit(0);
      } catch (e) {
        config.logger.warn(`shutdown process failed, exiting with code 1`);
        config.logger.error(e);
        process.exit(1);
      }
    });
  });

  return async (reason?: string) => {
    try {
      config.logger.info(`Manual shutdown ${reason ? `(${reason})` : ''}`);
      await shutdown();
      config.logger.info(`shutdown process done, exiting with code 0`);
      process.exit(0);
    } catch (e) {
      config.logger.warn(`shutdown process failed, exiting with code 1`);
      config.logger.error(e);
      process.exit(1);
    }
  };
}
