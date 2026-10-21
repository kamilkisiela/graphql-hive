/**
 * Thrown by the CORS origin check. The status and code let the shared error handler from
 * `createServer` answer it as a 403 instead of reporting it as an unhandled 500.
 */
export class CorsError extends Error {
  readonly statusCode = 403;
  readonly code = 'CORS_ORIGIN_NOT_ALLOWED';

  constructor() {
    super('CORS origin not allowed.');
  }
}
