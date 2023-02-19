import { env } from '@/env/frontend';

export const getDocsUrl = (path = '') => {
  const { docsUrl } = env;
  if (!docsUrl) {
    return null;
  }
  return `${docsUrl}${path}`;
};
