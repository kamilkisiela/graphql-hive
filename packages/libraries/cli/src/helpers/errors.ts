import { extname } from 'node:path';
import { env } from 'node:process';
import { GraphQLError, Source } from 'graphql';
import { CLIError } from '@oclif/core/lib/errors';
import { CompositionFailure } from '@theguild/federation-composition';
import { FragmentType, makeFragmentData } from '../gql/index';
import { renderErrors, RenderErrors_SchemaErrorConnectionFragment } from './schema';
import { Texture } from './texture/texture';

export enum ExitCode {
  // The command execution succeeded.
  SUCCESS = 0,

  // The command ran, but the operation it performed failed.
  ERROR = 1,

  // The request took too long and timed out. The operation may still have completed on the server.
  TIMED_OUT = 2,

  // The command could not start because of invalid input or setup. E.g. malformed arguments, flags, files or configuration.
  BAD_INIT = 3,
}

export const exitCodeDescriptions: Record<ExitCode, string> = {
  [ExitCode.SUCCESS]: 'The command succeeded.',
  [ExitCode.ERROR]: 'The command ran, but the operation failed.',
  [ExitCode.TIMED_OUT]:
    'A request timed out. The operation may still have completed on the server.',
  [ExitCode.BAD_INIT]:
    'The command could not start because of invalid input or setup, such as arguments, flags, files or configuration.',
};

export const ERRORS_DOCS_URL = 'https://the-guild.dev/graphql/hive/docs/api-reference/cli';

export function errorDocsAnchor(code: number) {
  return `errors-${code}`;
}

export interface HiveCLIErrorClass {
  readonly name: string;
  readonly code: number;
  readonly exitCode: ExitCode;
  readonly title: string;
  readonly fix: string;
}

export abstract class HiveCLIError extends CLIError {
  static readonly code: number;
  static readonly exitCode: ExitCode;
  static readonly title: string;
  static readonly fix: string;

  public readonly exitCode: ExitCode;
  public readonly errorCode: number;
  /** The message without the error code and the link to the documentation. */
  public readonly plainMessage: string;

  constructor(message: string) {
    const meta = new.target as unknown as HiveCLIErrorClass;
    const tip = `> See ${ERRORS_DOCS_URL}#${errorDocsAnchor(meta.code)} for a complete list of error codes and recommended fixes.
To disable this message set HIVE_NO_ERROR_TIP=1`;
    super(`${message}  [${meta.code}]${env.HIVE_NO_ERROR_TIP === '1' ? '' : `\n${tip}`}`, {
      exit: meta.exitCode,
    });
    this.exitCode = meta.exitCode;
    this.errorCode = meta.code;
    this.plainMessage = message;
  }
}

/** Categorized by the command that introduced the error. Errors shared by many commands are GENERIC. */
enum ErrorCategory {
  GENERIC = 1_00,
  SCHEMA_CHECK = 2_00,
  SCHEMA_PUBLISH = 3_00,
  APP_CREATE = 4_00,
  ARTIFACT_FETCH = 5_00,
  DEV = 6_00,
  OPERATIONS_CHECK = 7_00,
}

export const errorCategories: ReadonlyArray<{ name: string; start: number }> = [
  { name: 'Generic', start: ErrorCategory.GENERIC },
  { name: 'Schema check', start: ErrorCategory.SCHEMA_CHECK },
  { name: 'Schema publish', start: ErrorCategory.SCHEMA_PUBLISH },
  { name: 'App create', start: ErrorCategory.APP_CREATE },
  { name: 'Artifact fetch', start: ErrorCategory.ARTIFACT_FETCH },
  { name: 'Dev', start: ErrorCategory.DEV },
  { name: 'Operations check', start: ErrorCategory.OPERATIONS_CHECK },
];

const errorCode = (category: ErrorCategory, id: number): number => {
  return category + id;
};

export class InvalidConfigError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 0);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Invalid configuration file';
  static readonly fix =
    'Fix the reported problem in `hive.json` (or the file set with `HIVE_CONFIG`). Supported keys are `registry.endpoint`, `registry.accessToken`, `registry.headers`, `cdn.endpoint` and `cdn.accessToken`. When `HIVE_SPACE` is set, the file must contain a top-level key with that name.';
  constructor(configPath: string, reason: string) {
    super(`The configuration file "${configPath}" is invalid: ${reason}`);
  }
}

export class InvalidCommandError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 1);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Unknown command';
  static readonly fix = 'Run `hive help` to list the available commands and check the spelling.';
  constructor(command: string) {
    super(`The command, "${command}", does not exist.`);
  }
}

export class MissingArgumentsError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 2);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing required argument';
  static readonly fix =
    'Provide the listed arguments or flags. Organization access tokens always require the `--target` flag.';
  constructor(...requiredArgs: Array<[string, string]>) {
    const argsStr = requiredArgs.map(a => `${a[0].toUpperCase()} \t${a[1]}`).join('\n');
    super(
      `Missing ${requiredArgs.length} required argument${requiredArgs.length > 1 ? 's' : ''}:\n${argsStr}`,
    );
  }
}

export class MissingRegistryTokenError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 3);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing registry access token';
  static readonly fix =
    'Pass `--registry.accessToken`, set `HIVE_TOKEN`, or set `registry.accessToken` in `hive.json`.';
  constructor() {
    super(
      `A registry token is required to perform the action. For help generating an access token, see https://the-guild.dev/graphql/hive/docs/management/targets#registry-access-tokens`,
    );
  }
}

export class MissingCdnKeyError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 4);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing CDN access token';
  static readonly fix =
    'Pass `--cdn.accessToken`, set `HIVE_CDN_ACCESS_TOKEN`, or set `cdn.accessToken` in `hive.json`.';
  constructor() {
    super(
      `A CDN key is required to perform the action. For help generating a CDN key, see https://the-guild.dev/graphql/hive/docs/management/targets#cdn-access-tokens`,
    );
  }
}

export class MissingEndpointError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 5);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing registry endpoint';
  static readonly fix =
    'Pass `--registry.endpoint`, set `HIVE_REGISTRY`, or set `registry.endpoint` in `hive.json`. Make sure `HIVE_REGISTRY` is not set to an empty string.';
  constructor() {
    super(`A registry endpoint is required to perform the action.`);
  }
}

export class InvalidRegistryTokenError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 6);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Invalid registry access token';
  static readonly fix =
    'Create a new access token, and check that the access token and the registry endpoint belong to the same Hive instance.';
  constructor() {
    super(
      `The registry access token was rejected. It does not exist, has expired, or has been revoked.`,
    );
  }
}

export class InvalidCdnKeyError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 7);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Invalid CDN access token';
  static readonly fix =
    'Create a new CDN access token for the target, and check that it belongs to the same target as the CDN endpoint.';
  constructor() {
    super(
      `A valid CDN key is required to perform the action. The CDN key used does not exist, has expired, or has been revoked.`,
    );
  }
}

export class MissingCdnEndpointError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 8);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing CDN endpoint';
  static readonly fix =
    'Pass `--cdn.endpoint`, set `HIVE_CDN_ENDPOINT`, or set `cdn.endpoint` in `hive.json`.';
  constructor() {
    super(`A CDN endpoint is required to perform the action.`);
  }
}

export class MissingEnvironmentError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 9);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing environment variable';
  static readonly fix =
    'Set the listed environment variables. With `--github`, run the command in GitHub Actions or set `GITHUB_REPOSITORY`.';
  constructor(...requiredVars: Array<[string, string]>) {
    const varsStr = requiredVars.map(a => `\t${a[0]} \t${a[1]}`).join('\n');
    super(
      `Missing required environment variable${requiredVars.length > 1 ? 's' : ''}:\n${varsStr}`,
    );
  }
}

export class CommitRequiredError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 10);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing commit';
  static readonly fix =
    'Pass `--commit` (or set `HIVE_COMMIT` for `schema:publish`), or run the command inside a git repository.';
  constructor() {
    super(
      `Couldn't resolve required commit sha. Provide a non-empty commit via the '--commit' parameter or execute the command within a git repository.`,
    );
  }
}

export class GithubRepositoryRequiredError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 11);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing GitHub repository';
  static readonly fix =
    'Run the command in GitHub Actions, where `GITHUB_REPOSITORY` is set, or in a CI environment that exposes the repository.';
  constructor() {
    super(`Couldn't resolve git repository required for GitHub Application.`);
  }
}

export class AuthorRequiredError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 12);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing author';
  static readonly fix =
    'Pass `--author` (or set `HIVE_AUTHOR` for `schema:publish`), or run the command inside a git repository with a configured user.';
  constructor() {
    super(
      `Couldn't resolve required commit author. Provide a non-empty author via the '--author' parameter or execute the command within a git repository.`,
    );
  }
}

export class HTTPError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 13);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'HTTP error response';
  static readonly fix =
    'A 4xx status usually means a wrong endpoint or a rejected request: check the endpoint URL and credentials. A 5xx status means the server failed: retry later.';
  constructor(endpoint: string, status: number, message: string, requestId?: string) {
    const is400 = status >= 400 && status < 500;
    super(
      `A ${is400 ? 'client' : 'server'} error occurred while performing the action. A call to "${endpoint}" failed with Status: ${status}, Text: ${message}` +
        (requestId ? `  (Request ID: "${requestId}")` : ''),
    );
  }
}

export class NetworkError extends HiveCLIError {
  static readonly code: number = errorCode(ErrorCategory.GENERIC, 14);
  static readonly exitCode: ExitCode = ExitCode.ERROR;
  static readonly title: string = 'Network error';
  static readonly fix: string =
    'The request did not complete. Check the network connection, DNS, proxy and TLS settings, and the endpoint URL, then retry.';
  constructor(cause: Error | string, message?: string) {
    super(
      message ??
        `A network error occurred while performing the action: "${cause instanceof Error ? `${cause.name}: ${cause.message}` : cause}"`,
    );
  }
}

/** GraphQL Errors returned from an operation. Note that some GraphQL Errors that require specific steps to correct are handled through other error types. */
export class APIError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 15);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'API error';
  static readonly fix =
    'Read the message returned by the Hive API. Include the request ID when contacting support.';
  public ref?: string;
  constructor(
    cause: Error | string,
    requestId?: string,
    public graphQLErrors?: ReadonlyArray<GraphQLError>,
  ) {
    super(
      (cause instanceof Error ? `${cause.name}: ${cause.message}` : cause) +
        (requestId ? `  (Request ID: "${requestId}")` : ''),
    );
    this.ref = requestId;
  }
}

export class IntrospectionError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 16);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Introspection failed';
  static readonly fix =
    'Make sure the service is running, reachable and allows introspection, or pass the schema file instead of the URL.';
  /** @param service The name or URL of the service. */
  constructor(service?: string) {
    super(
      `Could not get introspection result from the service${service ? ` '${service}'` : ''}. Make sure introspection is enabled by the server.`,
    );
  }
}

export class UnsupportedFileExtensionError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 17);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Unsupported file extension';
  static readonly fix = 'Use one of the supported file extensions listed in the message.';
  constructor(filename: string, supported?: string[]) {
    super(
      `Got unsupported file extension: "${extname(filename)}".${supported ? ` Try using one of the supported extensions: ${supported.join(',')}` : ''}`,
    );
  }
}

export class FileMissingError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 18);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'File not found';
  static readonly fix = 'Check that the path or glob matches at least one readable file.';
  constructor(fileName: string, additionalContext?: string) {
    super(`Failed to load file "${fileName}"${additionalContext ? `: ${additionalContext}` : '.'}`);
  }
}

export class InvalidFileContentsError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 19);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Invalid file contents';
  static readonly fix =
    'Make sure the file is readable and contains valid content in the expected format.';
  constructor(fileName: string, expectedFormat: string) {
    super(
      `File "${fileName}" could not be parsed. Please make sure the file is readable and contains a valid ${expectedFormat}.`,
    );
  }
}

export class InvalidTargetError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 20);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Invalid target';
  static readonly fix =
    'Pass the target as a slug in the form `organization/project/target`, or as a target UUID.';
  constructor(flagName = '--target') {
    super(
      `Invalid slug or ID provided for option "${flagName}". Must match target slug "$organization_slug/$project_slug/$target_slug" (e.g. "the-guild/graphql-hive/staging") or UUID (e.g. c8164307-0b42-473e-a8c5-2860bb4beff6).`,
    );
  }
}

export class InvalidFederationSubgraphError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 21);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Not a Federation subgraph';
  static readonly fix =
    'Point the URL at a Federation subgraph that exposes `Query._service.sdl`, or pass the schema file instead.';
  constructor(reason?: string) {
    super(
      `The provided service URL does not point to a valid Federation subgraph.${reason ? `\n${reason}\n` : ''}`,
    );
  }
}

export class InvalidVersionIdError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 22);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Invalid schema version ID';
  static readonly fix = 'Pass the ID of a schema version from the same project as the target.';
  constructor(flagName = '--version', reason?: string) {
    super(`Invalid version id provided for "${flagName}".${reason ? `\n${reason}\n` : ''}`);
  }
}

export class ConflictingOptionsError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 23);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Conflicting options';
  static readonly fix = 'Provide only one of the listed options.';
  constructor(flagNames: string[], reason?: string) {
    super(
      `The options ${flagNames.map(name => `"${name}"`).join(', ')} conflict. Please only provide one.${reason ? `\n${reason}\n` : ''}`,
    );
  }
}

/** The API rejected the action for an authenticated token (GraphQL error code UNAUTHORISED). */
export class AccessDeniedError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 24);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Access denied';
  static readonly fix =
    'Grant the named permission to the access token, check that `--target` points at an existing target the token can access, or use an organization access token.';
  public ref?: string;
  constructor(
    reason: string,
    public readonly permission: string | null,
    requestId?: string,
  ) {
    super(
      (permission
        ? `Access denied: the access token is missing the "${permission}" permission, or the target does not exist or is not accessible to this token.`
        : `Access denied: ${reason}`) + (requestId ? `  (Request ID: "${requestId}")` : ''),
    );
    this.ref = requestId;
  }
}

/** The API rejected the request during GraphQL validation, because the server does not know a field, argument or type the CLI sends. */
export class UnsupportedServerError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 25);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Unsupported Hive server version';
  static readonly fix =
    'Upgrade the Hive server to a version that supports this CLI version, or use an older CLI version that matches the server. Nothing was executed on the server.';
  constructor(
    endpoint: string,
    public graphQLErrors: ReadonlyArray<GraphQLError>,
  ) {
    super(
      `The Hive server at "${endpoint}" does not support this version of the CLI. The request was rejected before it ran:\n` +
        graphQLErrors.map(error => `- ${error.message}`).join('\n'),
    );
  }
}

export class RequestTimeoutError extends NetworkError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 26);
  static readonly exitCode = ExitCode.TIMED_OUT;
  static readonly title = 'Request timed out';
  static readonly fix =
    'The operation may have completed on the server. Check its result, for example in Hive Console or with `hive schema:fetch`, before retrying.';
  constructor(endpoint: string, cause: Error | string) {
    super(
      cause,
      `The request to "${endpoint}" timed out. The operation may still have completed on the server. Check its result before retrying.`,
    );
  }
}

export class InvalidInputError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 27);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Invalid command input';
  static readonly fix = 'Check the arguments and flags with `hive help <command>`.';
  public readonly showHelp: boolean;
  public readonly parse: unknown;
  constructor(cause: Error & { showHelp?: boolean; parse?: unknown }) {
    super(cause.message);
    this.showHelp = cause.showHelp ?? false;
    this.parse = cause.parse;
  }
}

export class InvalidHeaderError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 28);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Invalid header';
  static readonly fix =
    'Use the `Name=Value` format for `--registry.header` and the `Name:Value` format for `--header`.';
  constructor(header: string, format: 'Name=Value' | 'Name:Value') {
    super(`Invalid header "${header}". Expected ${format}.`);
  }
}

export class UnexpectedError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.GENERIC, 99);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Unexpected error';
  static readonly fix =
    'Re-run the command with `DEBUG=*` for more details, and report the output if the problem persists.';
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : JSON.stringify(cause);
    super(`An unexpected error occurred: ${message}\n> Enable DEBUG=* for more details.`);
  }
}

export class SchemaFileNotFoundError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.SCHEMA_CHECK, 0);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Schema not found';
  static readonly fix =
    'Check the file path, glob or URL. For a URL, make sure the service is reachable.';
  constructor(fileName: string, reason?: string | Error) {
    const message = reason instanceof Error ? reason.message : reason;
    super(`Error reading the schema file "${fileName}"${message ? `: ${message}` : '.'}`);
  }
}

export class SchemaFileEmptyError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.SCHEMA_CHECK, 1);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'No type definitions found';
  static readonly fix =
    'Make sure the schema contains GraphQL type definitions. In code files, the definitions must be in a template literal tagged with `gql` or `graphql`, or marked with a `/* GraphQL */` comment.';
  constructor(fileName: string) {
    super(`No GraphQL type definitions were found in "${fileName}".`);
  }
}

export class SchemaCheckFailedError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.SCHEMA_CHECK, 2);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Schema check failed';
  static readonly fix =
    'Review the errors and breaking changes in the output or the linked report. Fix them, approve expected breaking changes in Hive Console, or use `--forceSafe`.';
  constructor() {
    super('Schema check failed.');
  }
}

export class SchemaCheckApprovalFailedError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.SCHEMA_CHECK, 3);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Schema check approval failed';
  static readonly fix =
    'Make sure the access token has the `schemaCheck:approve` permission and that the failed schema check was stored by the registry.';
  constructor(reason: string) {
    super(`Failed to auto-approve the schema check: ${reason}`);
  }
}

export class SchemaPublishFailedError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.SCHEMA_PUBLISH, 0);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Schema publish failed';
  static readonly fix =
    'The schema was rejected and nothing was stored. Fix the reported errors and publish again.';
  constructor(details?: string | null) {
    super(`Schema publish failed.${details ? ` ${details}` : ''}`);
  }
}

export class InvalidSDLError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.SCHEMA_PUBLISH, 1);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Invalid SDL';
  static readonly fix = 'Fix the GraphQL syntax error at the reported location.';
  constructor(err: GraphQLError) {
    const location = err.locations?.[0];
    const locationString = location ? ` at line ${location.line}, column ${location.column}` : '';
    super(`The SDL is not valid${locationString}:\n ${err.message}`);
  }
}

export class SchemaPublishMissingServiceError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.SCHEMA_PUBLISH, 2);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing service name';
  static readonly fix =
    'Pass `--service <name>`. Federation and schema stitching projects require a service name.';
  constructor(message: string) {
    super(`${message} Please use the "--service <name>" parameter.`);
  }
}

export class SchemaPublishMissingUrlError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.SCHEMA_PUBLISH, 3);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Missing service URL';
  static readonly fix =
    'Pass `--url <url>`. A service needs a URL the first time it is published, and the URL must be valid.';
  constructor(message: string) {
    super(`${message} Please use the "--url <url>" parameter.`);
  }
}

export class PersistedOperationsMalformedError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.APP_CREATE, 0);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Malformed persisted documents';
  static readonly fix =
    'Use a GraphQL Code Generator, Relay or Apollo persisted query manifest, a directory of `.graphql` files, or a glob that matches `.graphql` files containing operations.';
  constructor(file: string, reason?: string) {
    super(
      `Persisted Operations file "${file}" is malformed.` +
        (reason
          ? ` ${reason}`
          : ' Please make sure it follows either the GraphQL Code Generator, Relay or Apollo Persisted Query Manifest Format.'),
    );
  }
}

export class SchemaNotFoundError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.ARTIFACT_FETCH, 0);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Schema not found in the registry';
  static readonly fix =
    'Publish a schema to the target first, or check the target, the commit and the `--type` value.';
  constructor(commit?: string) {
    super(`No schema found${commit ? ` for commit ${commit}.` : '.'}`);
  }
}

export class InvalidSchemaError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.ARTIFACT_FETCH, 1);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Schema version is not valid';
  static readonly fix =
    'The requested schema version is not valid. Use a different commit, or fix and publish the schema again.';
  constructor(commit?: string) {
    super(`Schema is invalid${commit ? ` for commit ${commit}.` : '.'}`);
  }
}

export class ServiceAndUrlLengthMismatch extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.DEV, 0);
  static readonly exitCode = ExitCode.BAD_INIT;
  static readonly title = 'Service and URL count mismatch';
  static readonly fix = 'Pass exactly one `--url` for every `--service`.';
  constructor(services: string[], urls: string[]) {
    super(
      `Not every services has a matching url. Got ${services.length} services and ${urls.length} urls.`,
    );
  }
}

export class LocalCompositionError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.DEV, 1);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Local composition failed';
  static readonly fix = 'Fix the composition errors in the listed subgraphs.';
  constructor(compositionResult: CompositionFailure) {
    const message = renderErrors(
      makeFragmentData(
        {
          edges: compositionResult.errors.map(error => ({
            node: {
              message: error.message,
            },
          })),
        },
        RenderErrors_SchemaErrorConnectionFragment,
      ),
    );
    super(`Local composition failed:\n${message}`);
  }
}

export class RemoteCompositionError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.DEV, 2);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Remote composition failed';
  static readonly fix = 'Fix the composition errors in the listed subgraphs.';
  constructor(errors: FragmentType<typeof RenderErrors_SchemaErrorConnectionFragment>) {
    super(`Remote composition failed:\n${renderErrors(errors)}`);
  }
}

export class InvalidCompositionResultError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.DEV, 3);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Invalid composition result';
  static readonly fix = 'The composed supergraph is invalid. Report the output as a bug.';
  /** Compose API spits out the error message */
  constructor(supergraph?: string | undefined | null) {
    super(`Composition resulted in an invalid supergraph: ${supergraph}`);
  }
}

export class InvalidDocumentsError extends HiveCLIError {
  static readonly code = errorCode(ErrorCategory.OPERATIONS_CHECK, 0);
  static readonly exitCode = ExitCode.ERROR;
  static readonly title = 'Invalid operations';
  static readonly fix = 'Fix the listed operations so that they are valid against the schema.';
  constructor(
    invalidDocuments: Array<{
      source: string | Source;
      errors: ReadonlyArray<GraphQLError>;
    }>,
  ) {
    const message = invalidDocuments
      .map(doc => {
        return `${Texture.failure(doc.source)}\n${doc.errors.map(e => ` - ${Texture.boldQuotedWords(e.message)}`).join('\n')}`;
      })
      .join('\n');
    super(`Invalid operation syntax:\n${message}`);
  }
}

/** Every error the CLI can report. Documentation is generated from this list. */
export const errorCatalog: ReadonlyArray<HiveCLIErrorClass> = [
  InvalidConfigError,
  InvalidCommandError,
  MissingArgumentsError,
  MissingRegistryTokenError,
  MissingCdnKeyError,
  MissingEndpointError,
  InvalidRegistryTokenError,
  InvalidCdnKeyError,
  MissingCdnEndpointError,
  MissingEnvironmentError,
  CommitRequiredError,
  GithubRepositoryRequiredError,
  AuthorRequiredError,
  HTTPError,
  NetworkError,
  APIError,
  IntrospectionError,
  UnsupportedFileExtensionError,
  FileMissingError,
  InvalidFileContentsError,
  InvalidTargetError,
  InvalidFederationSubgraphError,
  InvalidVersionIdError,
  ConflictingOptionsError,
  AccessDeniedError,
  UnsupportedServerError,
  RequestTimeoutError,
  InvalidInputError,
  InvalidHeaderError,
  UnexpectedError,
  SchemaFileNotFoundError,
  SchemaFileEmptyError,
  SchemaCheckFailedError,
  SchemaCheckApprovalFailedError,
  SchemaPublishFailedError,
  InvalidSDLError,
  SchemaPublishMissingServiceError,
  SchemaPublishMissingUrlError,
  PersistedOperationsMalformedError,
  SchemaNotFoundError,
  InvalidSchemaError,
  ServiceAndUrlLengthMismatch,
  LocalCompositionError,
  RemoteCompositionError,
  InvalidCompositionResultError,
  InvalidDocumentsError,
];

export interface AggregateError extends Error {
  errors: Error[];
}

export function isAggregateError(error: unknown): error is AggregateError {
  return !!error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors);
}

/** Whether the error, or one of its causes, is a request timeout (`AbortSignal.timeout`). */
export function isTimeoutError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    if ((current as { name?: unknown }).name === 'TimeoutError') {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
