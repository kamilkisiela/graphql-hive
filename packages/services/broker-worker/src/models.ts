import { z } from 'zod';
import type { SignatureValidator } from './auth';
import { InvalidRequestFormat, InvalidSignature, MissingSignature } from './errors';
import type { Logger } from './types';

const SIGNATURE_HEADER_NAME = 'x-hive-signature';

const RequestModelSchema = z.union([
  z.object({
    method: z.literal('GET'),
    url: z.string().min(1),
    headers: z.record(z.string()).optional(),
  }),
  z.object({
    method: z.literal('POST'),
    url: z.string().min(1),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
    resolveResponseBody: z.boolean().optional().default(true),
  }),
]);

export async function parseIncomingRequest(
  request: Request,
  keyValidator: SignatureValidator,
  logger: Logger,
): Promise<{ error: Response } | z.infer<typeof RequestModelSchema>> {
  if (request.method !== 'POST') {
    logger.error(
      'Failed to parse request',
      new Error(`Only POST requests are allowed, got ${request.method}`),
    );
    return {
      error: new Response('Only POST requests are allowed', {
        status: 405,
        statusText: 'Method Not Allowed',
      }),
    };
  }

  const signature = request.headers.get(SIGNATURE_HEADER_NAME);

  if (!signature) {
    return {
      error: new MissingSignature(logger),
    };
  }

  if (!keyValidator(signature)) {
    return {
      error: new InvalidSignature(logger),
    };
  }

  const parseResult = RequestModelSchema.safeParse(await request.json<unknown>());

  if (!parseResult.success) {
    return { error: new InvalidRequestFormat(logger, parseResult.error.message) };
  }

  return parseResult.data;
}
