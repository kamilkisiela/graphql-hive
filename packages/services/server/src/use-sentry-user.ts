import type { Plugin } from '@envelop/types';
import * as Sentry from '@sentry/node';

export function extractUserId(context?: { user?: { superTokensUserId: string } }) {
  const superTokensUserId = context?.user?.superTokensUserId;

  return superTokensUserId ?? null;
}

export const useSentryUser = (): Plugin<{
  user: any;
}> => {
  return {
    onExecute({ args }) {
      const id = extractUserId(args.contextValue);

      if (id) {
        Sentry.configureScope(scope => {
          scope.setUser({
            id,
          });
        });
      }
    },
  };
};
