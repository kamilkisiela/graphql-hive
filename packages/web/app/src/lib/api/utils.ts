import { stripIgnoredCharacters } from 'graphql';
import type { ExecutionResult } from 'graphql';

export async function graphql<T = any>({
  url,
  headers,
  operationName,
  query,
  variables,
}: {
  url: string;
  headers: Record<string, any>;
  operationName: string;
  query: string;
  variables?: Record<string, any>;
}): Promise<ExecutionResult<T>> {
  const response = await fetch(url, {
    headers,
    method: 'POST',
    body: JSON.stringify({
      operationName,
      query: stripIgnoredCharacters(query),
      variables,
    }),
  } as any);

  return response.json();
}
