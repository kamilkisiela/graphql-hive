import { env } from '@/env/frontend';

const remoteDocsUrl = 'https://the-guild.dev/graphql/hive/docs/';

function resolveUrl(baseUrl: string, path: string) {
  if (path.startsWith('/')) {
    path = path.slice(1);
  }

  const separator = baseUrl.endsWith('/') ? '' : '/';
  return `${baseUrl}${separator}${path}`;
}

export function getDocsUrl(path = '') {
  const { docsUrl = remoteDocsUrl } = env;
  return resolveUrl(docsUrl, path);
}

export function getProductUpdatesUrl(path = '') {
  const { docsUrl = remoteDocsUrl } = env;
  const productUpdatesUrl = docsUrl.replace('/docs', '/product-updates');

  return resolveUrl(productUpdatesUrl, path);
}
