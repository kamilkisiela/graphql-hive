import { env } from '@/env/frontend';

export const getDocsUrl = (path = '') => {
  const docsUrl = env.docsUrl;
  if (!docsUrl) {
    return null;
  }
  return `${docsUrl}${path}`;
};
