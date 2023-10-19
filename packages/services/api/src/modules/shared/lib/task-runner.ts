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

  function loop() {
    task = scheduleTask({
      runInMilliSeconds: args.interval,
      run: args.run,
      logger: args.logger,
      name: 'schema-purge',
    });
    task.done.finally(() => {
      if (!isStopped) {
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
  runInMilliSeconds: number;
  run: () => Promise<void>;
  name: string;
  logger: Logger;
}) => {
  const runsAt = new Date(Date.now() + args.runInMilliSeconds).toISOString();
  args.logger.info(`Scheduling task "${args.name}" to run at ${runsAt}.`);
  let timeout: null | NodeJS.Timeout = setTimeout(async () => {
    timeout = null;
    args.logger.info(`Running task "${args.name}" to run at ${runsAt}.`);
    try {
      await args.run();
    } catch (err: unknown) {
      args.logger.error(`Failed to run task "${args.name}" to run at ${runsAt}.`, err);
    }
    args.logger.info(`Completed running task "${args.name}" to run at ${runsAt}.`);
    deferred.resolve();
  }, args.runInMilliSeconds);
  const deferred = createDeferred();

  return {
    done: deferred.promise,
    cancel: () => {
      if (timeout) {
        clearTimeout(timeout);
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
