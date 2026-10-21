import type { FastifyReply, FastifyRequest } from 'fastify';

export class CorsError extends Error {
  constructor() {
    super('CORS origin not allowed.');
  }
}

export function handleRequestError(error: Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof CorsError) {
    return reply.status(403).send(error.message);
  }

  request.log.error(error);
  // Fastify treats a returned reply as "the handler sends it"; without `send()` the request
  // stays open until the client gives up.
  return reply.status(500).send();
}
