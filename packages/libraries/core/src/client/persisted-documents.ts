import type { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue.js';
import LRU from 'tiny-lru';
import { http } from './http-client.js';
import type { Logger, PersistedDocumentsConfiguration } from './types';

type HeadersObject = {
  get(name: string): string | null;
};

export function createPersistedDocuments(
  config: PersistedDocumentsConfiguration & {
    logger: Logger;
  },
): null | {
  resolve(documentId: string): Promise<string | null>;
  allowArbitraryDocuments(context: { headers?: HeadersObject }): PromiseOrValue<boolean>;
} {
  const persistedDocumentsCache = LRU<string>(config.cache ?? 10_000);

  let allowArbitraryDocuments: (context: { headers?: HeadersObject }) => PromiseOrValue<boolean>;

  if (typeof config.allowArbitraryDocuments === 'boolean') {
    let value = config.allowArbitraryDocuments;
    allowArbitraryDocuments = () => value;
  } else if (typeof config.allowArbitraryDocuments === 'function') {
    allowArbitraryDocuments = config.allowArbitraryDocuments;
  } else {
    allowArbitraryDocuments = () => false;
  }

  /** if there is already a in-flight request for a document, we re-use it. */
  const fetchCache = new Map<string, Promise<string | null>>();

  /** Batch load a persisted documents */
  async function loadPersistedDocument(documentId: string) {
    const document = persistedDocumentsCache.get(documentId);
    if (document) {
      return document;
    }

    const cdnDocumentId = documentId.replaceAll('~', '/');

    const url = config.cdn.endpoint + '/apps/' + cdnDocumentId;
    let promise = fetchCache.get(url);

    if (!promise) {
      promise = http
        .get(url, {
          headers: {
            'X-Hive-CDN-Key': config.cdn.accessToken,
          },
          logger: config.logger,
          isRequestOk: response => response.status === 200 || response.status === 404,
        })
        .then(async response => {
          if (response.status !== 200) {
            return null;
          }
          const text = await response.text();
          persistedDocumentsCache.set(documentId, text);
          return text;
        })
        .finally(() => {
          fetchCache.delete(url);
        });

      fetchCache.set(url, promise);
    }

    return promise;
  }

  return {
    allowArbitraryDocuments,
    resolve: loadPersistedDocument,
  };
}
