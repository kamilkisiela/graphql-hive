import { MutationResolvers, TargetAccessScope } from '../../../../__generated__/types.next';
import { validateTargetAccess } from '../../../collection/resolvers';
import { PreflightScriptProvider } from '../../providers/preflight-script.provider';

export const createPreflightScript: NonNullable<
  MutationResolvers['createPreflightScript']
> = async (_parent, { selector, input }, { injector }) => {
  const target = await validateTargetAccess(injector, selector, TargetAccessScope.REGISTRY_WRITE);
  const result = await injector
    .get(PreflightScriptProvider)
    .createPreflightScript(target.id, input);

  return {
    ok: {
      __typename: 'PreflightScriptOkPayload',
      preflightScript: result,
      updatedTarget: target,
    },
  };
};
