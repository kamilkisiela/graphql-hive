export class InvalidRequestFormat extends Response {
  constructor(message: string) {
    super(
      JSON.stringify({
        code: 'INVALID_REQUEST_FORMAT',
        error: `Invalid artifact type: "${message}"`,
      }),
      {
        status: 400,
      }
    );
  }
}

export class MissingSignature extends Response {
  constructor() {
    super(
      JSON.stringify({
        code: 'MISSING_SIGNATURE',
        error: `Broker needs a signature to verify the origin of the request`,
      }),
      {
        status: 401,
      }
    );
  }
}

export class InvalidSignature extends Response {
  constructor() {
    super(
      JSON.stringify({
        code: 'INVALID_SIGNATURE',
        error: `Failed to verify the origin of the request`,
      }),
      {
        status: 403,
      }
    );
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
      }
    );
  }
}
