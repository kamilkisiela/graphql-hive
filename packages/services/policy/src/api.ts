import type { FastifyRequest } from 'fastify';
import { z, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { handleTRPCError } from '@hive/service-common';
import { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import { policyCheckCounter, policyCheckDuration } from './metrics';
import { createInputValidationSchema, normalizeAjvSchema, schemaPolicyCheck } from './policy';
import { RELEVANT_RULES } from './rules';

export type { PolicyConfigurationObject } from './policy';

export interface Context {
  req: FastifyRequest;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
        formatted:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? fromZodError(error.cause).message
            : null,
      },
    };
  },
});
const errorMiddleware = t.middleware(handleTRPCError);
const procedure = t.procedure.use(errorMiddleware);

const CONFIG_VALIDATION_SCHEMA = createInputValidationSchema();
const CONFIG_CHECK_INPUT_VALIDATION = z
  .object({
    config: CONFIG_VALIDATION_SCHEMA,
  })
  .required();
const POLICY_CHECK_INPUT_VALIDATION = z
  .object({
    /**
     * Target ID, used mainly for logging purposes
     */
    target: z.string(),
    /**
     * Represents the part of the schema that was changed (e.g. a service)
     */
    source: z.string().min(1),
    /**
     * Represents the complete schema, not just the changed service
     */
    schema: z.string().min(1),
    /**
     * The ESLint policy config JSON
     */
    policy: CONFIG_VALIDATION_SCHEMA,
  })
  .required();

export const schemaPolicyApiRouter = t.router({
  availableRules: procedure.query(() => {
    return RELEVANT_RULES.map(([name, rule]) => ({
      name,
      description: rule.meta.docs?.description || '',
      recommended: rule.meta.docs?.recommended ?? false,
      url: rule.meta.docs?.url,
      schema: normalizeAjvSchema(rule.meta.schema) as object | null,
    }));
  }),
  validateConfig: procedure.input(CONFIG_CHECK_INPUT_VALIDATION).query(() => {
    // Zod is doing the validation, so we just need to return true if case it's valid
    return true;
  }),
  checkPolicy: procedure.input(POLICY_CHECK_INPUT_VALIDATION).mutation(async ({ input, ctx }) => {
    policyCheckCounter.inc({ target: input.target });
    ctx.req.log.info(`Policy execution started, input is: %o`, input);

    const stopTimer = policyCheckDuration.startTimer({ target: input.target });
    const result = await schemaPolicyCheck({
      source: input.source,
      schema: input.schema,
      policy: input.policy,
    });
    stopTimer();

    ctx.req.log.info(`Policy execution was done for target ${input.target}, result is: %o`, {
      result,
    });

    return result;
  }),
});

export type SchemaPolicyApi = typeof schemaPolicyApiRouter;
export type SchemaPolicyApiInput = inferRouterInputs<SchemaPolicyApi>;

type RouterOutput = inferRouterOutputs<SchemaPolicyApi>;
export type AvailableRulesResponse = RouterOutput['availableRules'];
export type CheckPolicyResponse = RouterOutput['checkPolicy'];
