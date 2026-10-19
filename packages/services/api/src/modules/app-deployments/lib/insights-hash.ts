import { parse } from 'graphql';
import { preprocessOperation } from '@graphql-hive/core';

export function getDocumentInsightsHash(document: {
  body: string;
  operationName: string | null;
  internalHash: string;
}): string {
  try {
    return (
      preprocessOperation({
        document: parse(document.body),
        operationName: document.operationName,
        schemaCoordinates: [],
      })?.hash ?? document.internalHash
    );
  } catch {
    return document.internalHash;
  }
}
