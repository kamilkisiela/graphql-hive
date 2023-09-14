import { createFetch } from '@whatwg-node/fetch';
import type { Analytics } from './analytics';

const { Response } = createFetch({ useNodeFetch: true });

export function createResponse(
  analytics: Analytics,
  body: BodyInit | null,
  init: ResponseInit,
  targetId: string,
) {
  analytics.track(
    {
      type: 'response',
      statusCode: init.status ?? 999 /* indicates unknown status code, for some reason... */,
    },
    targetId,
  );

  return new Response(body, init);
}
