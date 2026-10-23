import { SchemaPublisher } from '../../providers/schema-publisher';
import type { MutationResolvers } from './../../../../__generated__/types';

export const deleteContract: NonNullable<MutationResolvers['deleteContract']> = async (
  _,
  args,
  context,
) => {
  const result = await context.injector.get(SchemaPublisher).deleteContract(
    {
      contractId: args.input.contract.byId,
    },
    context.request.signal,
  );

  if (result.type === 'success') {
    return {
      ok: {
        deletedContractId: result.contractId,
      },
    };
  }

  return {
    error: {
      message: result.message,
    },
  };
};
