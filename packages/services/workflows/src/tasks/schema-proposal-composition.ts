/**
 * Runs schema composition as a job and then notifies the server when completed.
 *
 * There's a delay between when this is added and when it's ran on the off chance
 * that more requests come in requesting composition for the proposal
 */

import { z } from 'zod';
import { defineTask, implementTask } from '../kit.js';
import { createSchemaObject } from '../lib/schema/provider';

function extendWithBase(schemas: Array<{ sdl: string }>, baseSchema: string | null) {
  if (!baseSchema) {
    return schemas;
  }

  return schemas.map((schema, index) => {
    if (index === 0) {
      return {
        ...schema,
        sdl: baseSchema + ' ' + schema.sdl,
      };
    }

    return schema;
  });
}

export const SchemaProposalCompositionTask = defineTask({
  name: 'schemaProposalComposition',
  schema: z.object({
    proposalId: z.string(),
    targetId: z.string(),
    externalComposition: z.object({
      enabled: z.boolean(),
      endpoint: z.string().nullable().optional(),
      encryptedSecret: z.string().nullable().optional(),
    }),
    native: z.boolean(),
  }),
});

export const task = implementTask(SchemaProposalCompositionTask, async args => {
  const schemas = await args.context.schema.proposedSchemas({
    pool: args.context.pg,
    proposalId: args.input.proposalId,
    targetId: args.input.targetId,
  });

  const baseSchema = await args.context.schema.getBaseSchema({
    pool: args.context.pg,
    targetId: args.input.targetId,
  });

  try {
    const result = await args.context.schema.composeAndValidate(
      schemas[0].type,
      extendWithBase(schemas, baseSchema).map(s => createSchemaObject(s)),
      {
        /** Whether external composition should be used (only Federation) */
        external: args.input.externalComposition,
        /** Whether native composition should be used (only Federation) */
        native: args.input.native,
        /** Proposals currently ignore contracts. */
        contracts: null,
      },
      { requestId: args.requestId },
    );

    const payload: { timestamp: string; status: 'ERROR' | 'SUCCESS'; reason: string | null } = {
      timestamp: new Date().toISOString(),
      status: result.errors.length ? 'ERROR' : 'SUCCESS',
      reason: result.errors.length ? result.errors.map(e => e.message).join('\n') : null,
    };
    await args.context.schema.updateSchemaProposalComposition({
      ...payload,
      proposalId: args.input.proposalId,
      pool: args.context.pg,
    });
    args.context.pubSub.publish('schemaProposalComposition', args.input.proposalId, payload);
  } catch (e) {
    // if the internal error persists, then this will be ran multiple times.
    args.logger.error('Something went wrong. %s', (e as Error).message);
    throw e;
  }
});
