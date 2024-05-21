import type { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue.js';
import LRU from 'tiny-lru';
import type { PersistedDocumentsConfiguration } from './types';

type HeadersObject = {
  get(name: string): string | null;
};

export function createPersistedDocuments(config: PersistedDocumentsConfiguration): null | {
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

  return {
    allowArbitraryDocuments,
    async resolve(documentId: string) {
      const document = persistedDocumentsCache.get(documentId);

      if (document) {
        return document;
      }

      const response = await fetch(config.endpoint + '/apps/' + documentId, {
        method: 'GET',
        headers: {
          'X-Hive-CDN-Key': config.accessToken,
        },
      });

      if (response.status !== 200) {
        return null;
      }
      const txt = await response.text();
      persistedDocumentsCache.set(documentId, txt);

      return txt;
    },
  };
}
