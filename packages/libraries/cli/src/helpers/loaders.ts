import { z } from 'zod';

const LoaderIdModel = z.enum(['graphql-file', 'code-file', 'json-file', 'url']);
const LoaderIdArrayModel = z.array(LoaderIdModel);
type LoaderId = z.infer<typeof LoaderIdModel>;

export async function getLoaders(defaultLoaders: LoaderId[]) {
  const requestedLoaders = LoaderIdArrayModel.parse(
    // Allows to override the list of loaders.
    // Integration tests use this to reduce the parsing time of JS code (less loaders, less code to parse).
    // It improves the performance of the tests by ~20% (locally).
    // eslint-disable-next-line no-process-env
    process.env.HIVE_CLI_LOADERS?.split(',') ?? defaultLoaders,
  );

  const loaders = await Promise.all(
    [
      requestedLoaders.includes('graphql-file')
        ? import('@graphql-tools/graphql-file-loader').then(m => m.GraphQLFileLoader)
        : null,
      requestedLoaders.includes('code-file')
        ? import('@graphql-tools/code-file-loader').then(m => m.CodeFileLoader)
        : null,
      requestedLoaders.includes('json-file')
        ? import('@graphql-tools/json-file-loader').then(m => m.JsonFileLoader)
        : null,
      requestedLoaders.includes('url')
        ? import('@graphql-tools/url-loader').then(m => m.UrlLoader)
        : null,
    ].filter(isDefined),
  );

  return loaders.map(loader => new loader());
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}
