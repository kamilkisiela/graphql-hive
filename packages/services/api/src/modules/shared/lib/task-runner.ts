import { type Logger } from '../providers/logger';

/**
 * Create task runner that runs a task at at a given interval.
 */
export const createTaskRunner = (args: {
  run: () => Promise<void>;
  interval: number;
  logger: Logger;
}) => {
  let task: ReturnType<typeof scheduleTask> | null = null;
  let isStarted = false;
  let isStopped = false;

  async function loop() {
    task = scheduleTask({
      runAt: args.interval,
      run: args.run,
      logger: args.logger,
      name: 'schema-purge',
    });
    task.done.finally(() => {
      if (!isStopped) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        loop();
      }
    });
  }

  return {
    start() {
      if (isStarted) {
        return;
      }
      isStarted = true;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      loop();
    },
    async stop() {
      isStopped = true;
      if (task) {
        task.cancel();
        await task.done;
      }
    },
  };
};

const scheduleTask = (args: {
  runAt: number;
  run: () => Promise<void>;
  name: string;
  logger: Logger;
}) => {
  args.logger.info(
    `Scheduling task "${args.name}" to run at ${new Date(args.runAt).toISOString()}`,
  );
  let timeout: null | NodeJS.Timeout = setTimeout(async () => {
    timeout = null;
    args.logger.info(`Running task "${args.name}" to run at ${new Date(args.runAt).toISOString()}`);
    await args.run();
    args.logger.info(
      `Completed running task "${args.name}" to run at ${new Date(args.runAt).toISOString()}`,
    );
    deferred.resolve();
  }, args.runAt);
  const deferred = createDeferred();

  return {
    done: deferred.promise,
    cancel: () => {
      if (timeout) {
        clearTimeout(timeout);
        return;
      }
      deferred.resolve();
    },
  };
};

const createDeferred = () => {
  let resolve: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });

  return {
    resolve: () => resolve(),
    promise,
  };
};
