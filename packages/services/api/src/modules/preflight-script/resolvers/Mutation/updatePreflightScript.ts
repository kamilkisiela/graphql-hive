import { MutationResolvers, TargetAccessScope } from '../../../../__generated__/types.next';
import { validateTargetAccess } from '../../../collection/resolvers';
import { PreflightScriptProvider } from '../../providers/preflight-script.provider';

export const updatePreflightScript: NonNullable<
  MutationResolvers['updatePreflightScript']
> = async (_parent, { selector, input }, { injector }) => {
  const target = await validateTargetAccess(injector, selector, TargetAccessScope.REGISTRY_WRITE);
  const result = await injector.get(PreflightScriptProvider).updatePreflightScript(input);

  if (!result) {
    return {
      error: {
        __typename: 'PreflightScriptError',
        message: 'Failed to update preflight script',
      },
    };
  }

  return {
    ok: {
      __typename: 'PreflightScriptOkPayload',
      preflightScript: result,
      updatedTarget: target,
    },
  };
};
