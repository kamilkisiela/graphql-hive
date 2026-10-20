import { readFileSync } from 'node:fs';
import { getErrorReference, renderErrorReferenceMarkdown } from '../src/helpers/error-docs';
import * as errors from '../src/helpers/errors';

const { errorCatalog, errorCategories, ExitCode, HiveCLIError } = errors;

function normalizeMarkdown(markdown: string) {
  return markdown
    .replace(/-{3,}/g, '---')
    .replace(/\s*\|\s*/g, '|')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('error catalog', () => {
  test('contains every exported error class', () => {
    const exportedErrorClasses = Object.values(errors).filter(
      value =>
        typeof value === 'function' &&
        value !== HiveCLIError &&
        value.prototype instanceof HiveCLIError,
    );

    expect(new Set(errorCatalog)).toEqual(new Set(exportedErrorClasses));
  });

  test('error codes are unique', () => {
    const codes = errorCatalog.map(error => error.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('error codes are within the range of their category', () => {
    for (const error of errorCatalog) {
      const category = [...errorCategories].reverse().find(c => error.code >= c.start);
      expect(category, error.name).toBeDefined();
      expect(error.code - category!.start, error.name).toBeLessThan(100);
    }
  });

  test('only timeouts use the TIMED_OUT exit code', () => {
    for (const error of errorCatalog) {
      if (error === errors.RequestTimeoutError) {
        expect(error.exitCode).toBe(ExitCode.TIMED_OUT);
      } else {
        expect([ExitCode.ERROR, ExitCode.BAD_INIT], error.name).toContain(error.exitCode);
      }
    }
  });

  test('every error has a title and a fix', () => {
    for (const error of errorCatalog) {
      expect(error.title.length, error.name).toBeGreaterThan(0);
      expect(error.fix.length, error.name).toBeGreaterThan(0);
    }
  });

  test('error codes are stable', () => {
    expect(
      Object.fromEntries(
        [...errorCatalog].sort((a, b) => a.code - b.code).map(error => [error.code, error.name]),
      ),
    ).toMatchInlineSnapshot(`
      {
        100: InvalidConfigError,
        101: InvalidCommandError,
        102: MissingArgumentsError,
        103: MissingRegistryTokenError,
        104: MissingCdnKeyError,
        105: MissingEndpointError,
        106: InvalidRegistryTokenError,
        107: InvalidCdnKeyError,
        108: MissingCdnEndpointError,
        109: MissingEnvironmentError,
        110: CommitRequiredError,
        111: GithubRepositoryRequiredError,
        112: AuthorRequiredError,
        113: HTTPError,
        114: NetworkError,
        115: APIError,
        116: IntrospectionError,
        117: UnsupportedFileExtensionError,
        118: FileMissingError,
        119: InvalidFileContentsError,
        120: InvalidTargetError,
        121: InvalidFederationSubgraphError,
        122: InvalidVersionIdError,
        123: ConflictingOptionsError,
        124: AccessDeniedError,
        125: UnsupportedServerError,
        126: RequestTimeoutError,
        127: InvalidInputError,
        128: InvalidHeaderError,
        199: UnexpectedError,
        200: SchemaFileNotFoundError,
        201: SchemaFileEmptyError,
        202: SchemaCheckFailedError,
        203: SchemaCheckApprovalFailedError,
        300: SchemaPublishFailedError,
        301: InvalidSDLError,
        302: SchemaPublishMissingServiceError,
        303: SchemaPublishMissingUrlError,
        400: PersistedOperationsMalformedError,
        401: InvalidPersistedDocumentsError,
        500: SchemaNotFoundError,
        501: InvalidSchemaError,
        600: ServiceAndUrlLengthMismatch,
        601: LocalCompositionError,
        602: RemoteCompositionError,
        603: InvalidCompositionResultError,
        700: InvalidDocumentsError,
      }
    `);
  });

  test('errors print their code and link to their documentation', () => {
    const error = new errors.InvalidTargetError();
    expect(error.errorCode).toBe(120);
    expect(error.exitCode).toBe(ExitCode.BAD_INIT);
    expect(error.oclif.exit).toBe(ExitCode.BAD_INIT);
    expect(error.message).toContain('  [120]');
    expect(error.message).toContain('/docs/api-reference/cli#errors-120 ');
    expect(error.plainMessage).toMatch(/^Invalid slug or ID provided for option "--target"\./);
    expect(error.plainMessage).not.toContain('[120]');
  });

  test('a timeout is a network error with its own code and exit code', () => {
    const error = new errors.RequestTimeoutError('https://example.com/graphql', 'TimeoutError');
    expect(error).toBeInstanceOf(errors.NetworkError);
    expect(error.errorCode).toBe(126);
    expect(error.exitCode).toBe(ExitCode.TIMED_OUT);
    expect(error.message).toContain('may still have completed on the server');
  });
});

describe('generated error documentation', () => {
  test('README.md contains the current error reference', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const section = readme.slice(
      readme.indexOf('<!-- errors -->') + '<!-- errors -->'.length,
      readme.indexOf('<!-- errorsstop -->'),
    );

    expect(
      normalizeMarkdown(section),
      'Run "pnpm --filter @graphql-hive/cli oclif:readme" to update README.md',
    ).toBe(normalizeMarkdown(renderErrorReferenceMarkdown()));
  });

  test('errors.json contains the current error reference', () => {
    const errorsJson = JSON.parse(readFileSync(new URL('../errors.json', import.meta.url), 'utf8'));

    expect(
      errorsJson,
      'Run "pnpm --filter @graphql-hive/cli oclif:readme" to update errors.json',
    ).toEqual(getErrorReference());
  });
});
