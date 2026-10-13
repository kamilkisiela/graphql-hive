import { Kind, parse, print, type DocumentNode } from 'graphql';
import { handleTemplate, mergeHeaders } from './operations.utils';
import type { LaboratorySettings } from './settings';

export type BuildCurlCommandInput = {
  endpoint: string;
  query: string;
  /** JSON strings straight off the operation, before template substitution. */
  variables?: string | null;
  headers?: string | null;
  extensions?: string | null;
  operationName?: string | null;
  /** Headers produced by preflight; they win over operation headers on conflict. */
  preflightHeaders?: Record<string, string>;
  env?: Record<string, unknown>;
  pluginsState?: Record<string, unknown>;
  settings?: Pick<LaboratorySettings, 'fetch'>;
};

/** Single-quoted shell literal: end the quote, escape, reopen. */
const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

const parseTemplatedJson = (
  value: string | null | undefined,
  scope: Record<string, unknown>,
): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(handleTemplate(value, scope)) ?? {};
  } catch {
    return {};
  }
};

/**
 * Keeps the selected operation and every fragment, dropping the other operations,
 * mirroring what the executor sends.
 */
const selectOperation = (query: string, operationName?: string | null): string => {
  let document: DocumentNode;

  try {
    document = parse(query);
  } catch {
    return query;
  }

  const definitions = document.definitions.filter(definition => {
    if (
      definition.kind === Kind.OPERATION_DEFINITION &&
      operationName &&
      definition.name?.value !== operationName
    ) {
      return false;
    }

    return true;
  });

  return print({ kind: Kind.DOCUMENT, definitions });
};

/**
 * Renders the active operation as a cURL command.
 *
 * Mirrors the request the laboratory itself sends (see runActiveOperation in
 * lib/operations.ts) so the copied command reproduces it, rather than being a
 * plausible-looking approximation.
 */
export function buildCurlCommand(input: BuildCurlCommandInput): string {
  const scope = { ...input.env, plugins: input.pluginsState ?? {} };

  const headers = mergeHeaders(
    {
      'content-type': 'application/json',
      ...(parseTemplatedJson(input.headers, scope) as Record<string, string>),
    },
    input.preflightHeaders ?? {},
  );

  const body: Record<string, unknown> = {
    query: selectOperation(input.query, input.operationName),
  };

  if (input.operationName) {
    body.operationName = input.operationName;
  }

  const variables = parseTemplatedJson(input.variables, scope);

  if (Object.keys(variables).length > 0) {
    body.variables = variables;
  }

  const extensions = parseTemplatedJson(input.extensions, scope);

  if (Object.keys(extensions).length > 0) {
    body.extensions = extensions;
  }

  const isGet = input.settings?.fetch?.useGETForQueries === true;
  const parts: string[] = ['curl'];

  let url = input.endpoint;

  if (isGet) {
    const params = new URLSearchParams({ query: body.query as string });

    if (input.operationName) {
      params.set('operationName', input.operationName);
    }

    if (body.variables) {
      params.set('variables', JSON.stringify(body.variables));
    }

    if (body.extensions) {
      params.set('extensions', JSON.stringify(body.extensions));
    }

    url = `${input.endpoint}?${params.toString()}`;
    delete headers['content-type'];
  } else {
    parts.push('-X POST');
  }

  parts.push(shellQuote(url));

  if (input.settings?.fetch?.credentials === 'include') {
    parts.push('--cookie-jar /dev/null');
  }

  for (const [name, value] of Object.entries(headers)) {
    parts.push(`-H ${shellQuote(`${name}: ${value}`)}`);
  }

  if (!isGet) {
    parts.push(`-d ${shellQuote(JSON.stringify(body))}`);
  }

  return parts.join(' \\\n  ');
}
