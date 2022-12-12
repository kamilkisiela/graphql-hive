import type * as tst from 'ts-toolbelt';

export async function runCheck<T extends Check<string, unknown, unknown>[]>(
  checks: T,
  rules: {
    [K in keyof CheckListToObject<T>]: 'required' | 'optional';
  },
): Promise<
  | { status: 'completed'; state: NonFailedState<CheckListToObject<T>> }
  | {
      status: 'failed';
      state: CheckListToObject<T>;
      step: NonCompleted<CheckResultOf<T[number]>> & {
        id: keyof CheckListToObject<T>;
      };
    }
> {
  const state: CheckListToObject<T> = checks.reduce(
    (acc, { id }) => ({
      ...acc,
      [id]: {
        id,
        status: 'skipped',
      },
    }),
    {} as any,
  );

  let status: 'completed' | 'failed' = 'completed';
  let failedStep: any | null = null;

  for await (const step of checks) {
    const r = await step.runner();
    const id = step.id as unknown as keyof typeof state;
    state[id] = {
      ...(r as any),
      id,
    };

    const isRequired = rules[id] === 'required';

    if ((isRequired && !isCompleted(r)) || r.status === 'failed') {
      failedStep = {
        ...r,
        id,
      };
      status = 'failed';
      break;
    }
  }

  if (status === 'failed') {
    return {
      status,
      step: failedStep,
      state,
    };
  }

  return {
    status,
    state: state as NonFailedState<CheckListToObject<T>>,
  };
}

export function createCheck<K extends string, C, F>(
  id: K,
  runner: () => Promise<CheckResult<C, F>>,
) {
  return {
    id,
    runner,
  };
}

// The reason why I'm using `result` and `reason` instead of just `data` for both:
// https://bit.ly/hive-check-result-data
export type CheckResult<C = unknown, F = unknown> =
  | {
      status: 'completed';
      result: C;
    }
  | {
      status: 'failed';
      reason: F;
    }
  | {
      status: 'skipped';
    };

type CheckResultOf<T> = T extends Check<string, infer C, infer F> ? CheckResult<C, F> : never;
type Check<K extends string, C, F> = {
  id: K;
  runner: () => Promise<CheckResult<C, F>>;
};

type CheckListToObject<T extends ReadonlyArray<Check<string, unknown, unknown>>> = tst.Union.Merge<
  T extends ReadonlyArray<infer U>
    ? U extends Check<infer IK, unknown, unknown>
      ? {
          [P in IK]: U['id'] extends P
            ? CheckResultOf<U> & {
                id: P;
              }
            : never;
        }
      : never
    : never
>;

function isCompleted<T extends CheckResult<unknown, unknown>>(step: T): step is Completed<T> {
  return step.status === 'completed';
}

type Completed<T> = T extends CheckResult<unknown, unknown>
  ? T extends { status: 'completed' }
    ? T
    : never
  : never;

type NonCompleted<T> = T extends CheckResult<unknown, unknown>
  ? T extends { status: 'completed' }
    ? never
    : T
  : never;

type NonFailed<T> = T extends CheckResult<unknown, unknown>
  ? T extends { status: 'failed' }
    ? never
    : T
  : never;

type WithId<T, K> = T & {
  id: K;
};

type NonFailedState<T> = T extends {
  [K in keyof T]: WithId<CheckResult<unknown, unknown>, K>;
}
  ? {
      [K in keyof T]: NonFailed<T[K]>;
    }
  : never;
