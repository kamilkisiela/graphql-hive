import { env } from '@/env/frontend';

export const getDocsUrl = (path = '') => {
  const { docsUrl } = env;
  if (!docsUrl) {
    return null;
  }
  return `${docsUrl.endsWith('/') ? docsUrl.slice(0, -1) : docsUrl}${path}`;
};

export const getProductUpdatesUrl = (path = '') => {
  const { docsUrl } = env;
  if (!docsUrl) {
    return null;
  }

  const productUpdatesUrl = docsUrl.replace('/docs', '/product-updates');

  return `${
    productUpdatesUrl.endsWith('/') ? productUpdatesUrl.slice(0, -1) : productUpdatesUrl
  }${path}`;
};
