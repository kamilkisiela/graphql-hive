import { createHash } from 'node:crypto';
import {
  Job,
  Task,
  TaskList,
  TaskSpec,
  WorkerEventMap,
  WorkerEvents,
  JobHelpers as WorkerJobHelpers,
} from 'graphile-worker';
import type { Client } from 'pg';
import { z, ZodSchema } from 'zod';
import { Storage } from '@hive/api';

export type Context = {
  storage: Storage;
};

export type JobHelpers = WorkerJobHelpers & {
  context: Context;
};

export type TypedTask<Payload, Return> = (payload: Payload, helpers: JobHelpers) => Promise<Return>;

export const createTask = <ZodType extends ZodSchema | null>(
  schema: ZodType,
  task: TypedTask<ZodType extends null ? null : z.infer<NonNullable<ZodType>>, void>,
) => {
  const wrappingTask: Task = async (payload, helpers) => {
    return await task(schema ? schema.parse(payload) : {}, helpers as JobHelpers);
  };

  return {
    task: wrappingTask as TypedTask<
      ZodType extends null ? null : z.infer<NonNullable<ZodType>>,
      void
    >,
    schema,
  };
};

/**
 * Wraps a task list with a lock, ensuring that when a worker unexpectedly dies, the task is not left in a locked state.
 * It also adds the `context` to the job's helpers.
 *
 * @param context The context to pass to the task
 * @param lockClient The Postgres client to use for locking
 * @param taskList The task list to wrap
 * @returns The new task list
 */
export function enhanceTaskList(
  context: Context,
  lockClient: Client,
  taskList: Record<string, TypedTask<any, any>>,
): TaskList {
  const newTaskList: typeof taskList = {};
  for (const taskName in taskList) {
    const task = taskList[taskName];

    if (!task) {
      continue;
    }

    newTaskList[taskName] = async (payload, helpers) => {
      const enhancedHelpers = {
        ...helpers,
        context,
      };
      if (!helpers.job.locked_by) {
        // TODO: think if we should lock the job here as well and what a lack of locked_by means
        helpers.logger.debug('Job is not locked, running task');
        return await task(payload, enhancedHelpers);
      }

      const lockId = stringTo64BitInt(helpers.job.locked_by);
      helpers.logger.debug('Attempting to acquire lock', { lockId });
      await lockClient.query('SELECT pg_advisory_lock($1)', [lockId]);

      try {
        helpers.logger.debug('Lock acquired, running task', { lockId });
        return await task(payload, enhancedHelpers);
      } finally {
        helpers.logger.debug('Releasing lock', { lockId });
        await lockClient.query('SELECT pg_advisory_unlock($1)', [lockId]);
      }
    };
  }

  return newTaskList as TaskList;
}

type GetTaskList<T> = () => T;
type GetTaskPayloadSchemaList<T> = () => T;

type AddTaskToZodTaskList<
  PreviousTaskList,
  Name extends string,
  Payload,
  Return,
> = PreviousTaskList & Record<Name, TypedTask<Payload, Return>>;

type AddTaskSchemaToZodTaskList<
  PreviousTaskPayloadSchemaList,
  Name extends string,
  ZodType extends ZodSchema | null,
> = PreviousTaskPayloadSchemaList & Record<Name, ZodType>;

type AddTaskFn<PreviousTaskList, PreviousTaskPayloadSchemaList> = <
  Name extends string,
  Payload,
  Return,
  ZodType extends ZodSchema | null,
>(
  name: Name,
  input: {
    task: TypedTask<Payload, Return>;
    schema: ZodType | null;
  },
  listeners?: Listeners<Name>,
) => {
  addTask: AddTaskFn<
    AddTaskToZodTaskList<PreviousTaskList, Name, Payload, Return>,
    AddTaskSchemaToZodTaskList<PreviousTaskPayloadSchemaList, Name, ZodType>
  >;
  getTaskList: GetTaskList<AddTaskToZodTaskList<PreviousTaskList, Name, Payload, Return>>;
  getTaskPayloadSchemaList: GetTaskPayloadSchemaList<
    AddTaskSchemaToZodTaskList<PreviousTaskPayloadSchemaList, Name, ZodType>
  >;
  registerEvents: (events: WorkerEvents) => void;
};

type Listeners<TaskName extends string = string> = ReplaceJobInEventMap<TaskName>;

type ReplaceJobInEventMap<TaskName extends string> = {
  // if `job` property is available, replace its task_identifier with the task name
  [EventName in keyof WorkerEventMap]?: (
    params: WorkerEventMap[EventName] extends { job: any }
      ? WorkerEventMap[EventName] & {
          job: WorkerEventMap[EventName]['job'] & {
            task_identifier: TaskName;
          };
        }
      : never,
  ) => void;
};

export const createTaskList = () => {
  const taskList: Record<string, TypedTask<any, any>> = {};
  const taskListSchema: Record<string, ZodSchema | null> = {};
  const listenersByTaskName: {
    [taskName: string]: Listeners;
  } = {};

  const getTaskList = () => taskList;
  const getTaskPayloadSchemaList = () => taskListSchema;
  const registeredEventNames = new Set<keyof Listeners>();
  const triggerEvent = <EventName extends keyof Listeners>(
    eventName: EventName,
    params: WorkerEventMap[EventName],
  ) => {
    if (!('job' in params) || !params.job) {
      return;
    }

    const listeners = listenersByTaskName[params.job.task_identifier];
    if (listeners && listeners[eventName]) {
      listeners[eventName](params as any);
    }
  };
  const registerEvents = (events: WorkerEvents) => {
    for (const eventName of registeredEventNames) {
      events.on(eventName, params => {
        triggerEvent(eventName, params);
      });
    }
  };

  const addTask = <Payload, Return, TaskName extends string>(
    name: TaskName,
    { task, schema }: { task: TypedTask<Payload, Return>; schema: ZodSchema | null },
    listeners?: Listeners<TaskName>,
  ) => {
    taskList[name] = task;
    taskListSchema[name] = schema;
    if (listeners) {
      listenersByTaskName[name] = listeners as Listeners;

      for (const eventName in listeners) {
        registeredEventNames.add(eventName as keyof Listeners);
      }
    }

    return { addTask, getTaskList, getTaskPayloadSchemaList, registerEvents };
  };

  return {
    addTask: addTask as AddTaskFn<{}, {}>,
    getTaskList,
    getTaskPayloadSchemaList,
    registerEvents,
  };
};

type TaskNamePayloadMaps<TaskListType extends Record<string, TypedTask<any, any>>> = {
  [Name in keyof TaskListType]: Parameters<TaskListType[Name]>[0];
};

export type AddJobFn<
  TaskListFactory extends {
    getTaskList: GetTaskList<Record<string, TypedTask<any, any>>>;
  },
> = <
  TaskListType extends ReturnType<TaskListFactory['getTaskList']>,
  Name extends keyof TaskListType,
>(
  helpers: Pick<JobHelpers, 'addJob'>,
  name: Name,
  payload: TaskNamePayloadMaps<TaskListType>[Name],
  spec: TaskSpec,
) => Promise<Job>;

function stringTo64BitInt(str: string) {
  const hash = createHash('sha256').update(str).digest('hex');
  // Take the first 15 characters of the hash (60 bits)
  const hash64 = hash.substring(0, 15);
  // Convert the 60-bit hash to an integer
  return BigInt('0x' + hash64);
}
