export const getDocsUrl = (path = '') => {
  const docsUrl = globalThis.process?.env['DOCS_URL'] ?? globalThis['__ENV__']?.['DOCS_URL'];
  if (!docsUrl) {
    return null;
  }
  return `${docsUrl}${path}`;
};
