import type { Plugin } from '@envelop/types';
import * as Sentry from '@sentry/node';

export function extractUserId(context?: { user?: { sub: string } }) {
  const sub = context?.user?.sub;

  if (sub) {
    const [provider, id] = sub.split('|');
    const maxLen = 10;

    // Why? Sentry hides a user id when it looks similar to an api key (long hash)
    return `${provider}|${
      id.length > maxLen ? id.substr(0, maxLen) + '...' : id
    }`;
  }

  return null;
}

export const useSentryUser = (): Plugin<{
  user: any;
}> => {
  return {
    onExecute({ args }) {
      const id = extractUserId(args.contextValue);

      if (id) {
        Sentry.configureScope((scope) => {
          scope.setUser({
            id,
          });
        });
      }
    },
  };
};
