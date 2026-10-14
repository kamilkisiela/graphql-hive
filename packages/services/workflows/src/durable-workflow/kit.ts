import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Common types                                                               */
/* -------------------------------------------------------------------------- */

export type AnyZodSchema = z.ZodTypeAny;

export type MaybePromise<T> = T | Promise<T>;

declare const taskDefinitionBrand: unique symbol;
declare const workflowDefinitionBrand: unique symbol;
declare const workflowInstructionBrand: unique symbol;
declare const workflowEffectBrand: unique symbol;

/**
 * Opaque instruction consumed by the workflow interpreter.
 */
export interface WorkflowInstruction {
  readonly [workflowInstructionBrand]: never;
}

/**
 * A typed workflow operation.
 *
 * `yield*` returns `TOutput`:
 *
 * const user = yield* ctx.task(fetchUser, ...);
 */
export interface WorkflowEffect<TOutput> {
  readonly [workflowEffectBrand]: TOutput;

  [Symbol.iterator](): Generator<WorkflowInstruction, TOutput, TOutput>;
}

export type WorkflowGenerator<TReturn> =
  | Generator<WorkflowInstruction, TReturn, any>
  | AsyncGenerator<WorkflowInstruction, TReturn, any>;

export type EffectOutput<TEffect> = TEffect extends WorkflowEffect<infer TOutput> ? TOutput : never;

/* -------------------------------------------------------------------------- */
/* Task definitions                                                           */
/* -------------------------------------------------------------------------- */

export interface TaskDefinition<
  TName extends string,
  TVersion extends number,
  TOutputSchema extends AnyZodSchema,
> {
  readonly kind: 'task';

  readonly name: TName;
  readonly version: TVersion;

  readonly output: TOutputSchema;

  readonly [taskDefinitionBrand]: {
    readonly outputCandidate: z.input<TOutputSchema>;
    readonly output: z.output<TOutputSchema>;
  };
}

export type AnyTaskDefinition = TaskDefinition<string, number, AnyZodSchema>;

/**
 * Value the task handler is allowed to return before output validation.
 */
export type TaskOutputCandidate<TTask extends AnyTaskDefinition> = z.input<TTask['output']>;

/**
 * Validated task result returned to workflow code.
 */
export type TaskOutput<TTask extends AnyTaskDefinition> = z.output<TTask['output']>;

export interface DefineTaskOptions<
  TName extends string,
  TVersion extends number,
  TOutputSchema extends AnyZodSchema,
> {
  readonly name: TName;
  readonly version: TVersion;

  readonly output: TOutputSchema;
}

export declare function defineTask<
  const TName extends string,
  const TVersion extends number,
  TOutputSchema extends AnyZodSchema,
>(
  options: DefineTaskOptions<TName, TVersion, TOutputSchema>,
): TaskDefinition<TName, TVersion, TOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Task execution                                                             */
/* -------------------------------------------------------------------------- */

export interface TaskExecutionContext {
  readonly runId: string;
  readonly stepId: string;
  readonly attempt: number;

  readonly signal: AbortSignal;
}

export type TaskHandler<
  TTask extends AnyTaskDefinition,
  TContext extends TaskExecutionContext = TaskExecutionContext,
> = (context: TContext) => MaybePromise<TaskOutputCandidate<TTask>>;

/* -------------------------------------------------------------------------- */
/* Workflow context                                                           */
/* -------------------------------------------------------------------------- */

export interface TaskInvocationOptions<TTask extends AnyTaskDefinition> {
  /**
   * Stable identity for this invocation within the workflow.
   */
  readonly id: string;

  /**
   * Execute the task when no recorded output exists for this invocation.
   */
  readonly run: TaskHandler<TTask>;
}

export type EffectTupleOutputs<TEffects extends readonly WorkflowEffect<any>[]> = {
  -readonly [TIndex in keyof TEffects]: EffectOutput<TEffects[TIndex]>;
};

export type EffectRecordOutputs<TEffects extends Readonly<Record<string, WorkflowEffect<any>>>> = {
  readonly [TKey in keyof TEffects]: EffectOutput<TEffects[TKey]>;
};

export interface WorkflowContext {
  /**
   * Schedule or replay a durable task invocation.
   */
  task<TTask extends AnyTaskDefinition>(
    task: TTask,
    options: TaskInvocationOptions<TTask>,
  ): WorkflowEffect<TaskOutput<TTask>>;

  /**
   * Wait for a tuple of effects.
   *
   * Tuple positions and output types are preserved.
   */
  all<const TEffects extends readonly WorkflowEffect<any>[]>(
    effects: TEffects,
  ): WorkflowEffect<EffectTupleOutputs<TEffects>>;

  /**
   * Wait for a named object of effects.
   *
   * Object keys and output types are preserved.
   */
  all<const TEffects extends Readonly<Record<string, WorkflowEffect<any>>>>(
    effects: TEffects,
  ): WorkflowEffect<EffectRecordOutputs<TEffects>>;
}

/* -------------------------------------------------------------------------- */
/* Workflow definitions                                                       */
/* -------------------------------------------------------------------------- */

export interface WorkflowDefinition<
  TName extends string,
  TVersion extends number,
  TInputSchema extends AnyZodSchema,
  TOutputSchema extends AnyZodSchema,
> {
  readonly kind: 'workflow';

  readonly name: TName;
  readonly version: TVersion;

  readonly input: TInputSchema;
  readonly output: TOutputSchema;

  readonly [workflowDefinitionBrand]: {
    readonly input: z.input<TInputSchema>;
    readonly parsedInput: z.output<TInputSchema>;
    readonly outputCandidate: z.input<TOutputSchema>;
    readonly output: z.output<TOutputSchema>;
  };
}

export type AnyWorkflowDefinition = WorkflowDefinition<string, number, AnyZodSchema, AnyZodSchema>;

/**
 * Value accepted when starting the workflow.
 */
export type WorkflowInput<TWorkflow extends AnyWorkflowDefinition> = z.input<TWorkflow['input']>;

/**
 * Value received by the workflow implementation after validation.
 */
export type WorkflowParsedInput<TWorkflow extends AnyWorkflowDefinition> = z.output<
  TWorkflow['input']
>;

/**
 * Value the workflow generator is allowed to return before validation.
 */
export type WorkflowOutputCandidate<TWorkflow extends AnyWorkflowDefinition> = z.input<
  TWorkflow['output']
>;

/**
 * Validated workflow result exposed to callers.
 */
export type WorkflowOutput<TWorkflow extends AnyWorkflowDefinition> = z.output<TWorkflow['output']>;

export interface DefineWorkflowOptions<
  TName extends string,
  TVersion extends number,
  TInputSchema extends AnyZodSchema,
  TOutputSchema extends AnyZodSchema,
> {
  readonly name: TName;
  readonly version: TVersion;

  readonly input: TInputSchema;
  readonly output: TOutputSchema;
}

export declare function defineWorkflow<
  const TName extends string,
  const TVersion extends number,
  TInputSchema extends AnyZodSchema,
  TOutputSchema extends AnyZodSchema,
>(
  options: DefineWorkflowOptions<TName, TVersion, TInputSchema, TOutputSchema>,
): WorkflowDefinition<TName, TVersion, TInputSchema, TOutputSchema>;

export interface WorkflowImplementationArgs<TWorkflow extends AnyWorkflowDefinition> {
  readonly input: WorkflowParsedInput<TWorkflow>;
  readonly context: WorkflowContext;
}

export type WorkflowImplementation<TWorkflow extends AnyWorkflowDefinition> = (
  args: WorkflowImplementationArgs<TWorkflow>,
) => WorkflowGenerator<WorkflowOutputCandidate<TWorkflow>>;

export interface ImplementedWorkflow<TWorkflow extends AnyWorkflowDefinition> {
  readonly definition: TWorkflow;
  readonly run: WorkflowImplementation<TWorkflow>;
}

/**
 * Implement a workflow.
 */
export declare function implementWorkflow<TWorkflow extends AnyWorkflowDefinition>(
  workflowDefinition: TWorkflow,
  implementation: WorkflowImplementation<TWorkflow>,
): ImplementedWorkflow<TWorkflow>;
