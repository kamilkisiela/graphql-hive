import type { Logger } from './types';

export class InvalidRequestFormat extends Response {
  constructor(logger: Logger, message: string) {
    super(
      JSON.stringify({
        code: 'INVALID_REQUEST_FORMAT',
        error: `Invalid payload provided: "${message}"`,
      }),
      {
        status: 400,
      },
    );
    logger.error(
      message,
      new Error(`INVALID_REQUEST_FORMAT`, {
        cause: message,
      }),
    );
  }
}

export class MissingSignature extends Response {
  constructor(logger: Logger) {
    super(
      JSON.stringify({
        code: 'MISSING_SIGNATURE',
        error: `Broker needs a signature to verify the origin of the request`,
      }),
      {
        status: 401,
      },
    );
    logger.error(
      'Broker needs a signature to verify the origin of the request',
      new Error(`MISSING_SIGNATURE`),
    );
  }
}

export class InvalidSignature extends Response {
  constructor(logger: Logger) {
    super(
      JSON.stringify({
        code: 'INVALID_SIGNATURE',
        error: `Failed to verify the origin of the request`,
      }),
      {
        status: 403,
      },
    );
    logger.error('Failed to verify the origin of the request', new Error(`INVALID_SIGNATURE`));
  }
}

export class UnexpectedError extends Response {
  constructor(errorId: string) {
    super(
      JSON.stringify({
        code: 'UNEXPECTED_ERROR',
        error: `Please try again later, or contact Hive support if the problem persists (error_id=${errorId})`,
      }),
      {
        status: 500,
      },
    );
  }
}
