import type { RateLimitApi } from '@hive/rate-limit';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { createFetch } from '@whatwg-node/fetch';
import { getServiceHost } from './utils';

const { fetch } = createFetch({
  useNodeFetch: true,
});

const rateLimitAddress = await getServiceHost('rate-limit', 3009);

export const rateLimitApi = createTRPCProxyClient<RateLimitApi>({
  links: [
    httpLink({
      url: `http://${rateLimitAddress}/trpc`,
      fetch,
    }),
  ],
});
