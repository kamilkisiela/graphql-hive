import { ContractsManager } from '../../providers/contracts-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createContract: NonNullable<MutationResolvers['createContract']> = async (
  _,
  args,
  context,
) => {
  const result = await context.injector.get(ContractsManager).createContract({
    contract: {
      targetId: args.input.targetId,
      contractName: args.input.contractName,
      excludeTags: (args.input.excludeTags as Array<string> | null) ?? null,
      includeTags: (args.input.includeTags as Array<string> | null) ?? null,
      removeUnreachableTypesFromPublicApiSchema:
        args.input.removeUnreachableTypesFromPublicApiSchema,
    },
  });

  if (result.type === 'success') {
    return {
      ok: {
        createdContract: result.contract,
      },
    };
  }

  return {
    error: {
      message: 'Something went wrong.',
      details: result.errors,
    },
  };
};
