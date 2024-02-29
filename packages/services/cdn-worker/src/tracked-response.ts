import type { Analytics } from './analytics';

export function createResponse(
  analytics: Analytics,
  body: BodyInit | null,
  init: ResponseInit,
  targetId: string,
  request: Request,
) {
  analytics.track(
    {
      type: 'response',
      statusCode: init.status ?? 999 /* indicates unknown status code, for some reason... */,
      requestPath: request.url,
    },
    targetId,
  );

  return new Response(body, init);
}
