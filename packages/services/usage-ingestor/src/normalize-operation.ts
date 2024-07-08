import { createHash } from 'node:crypto';
import {
  Kind,
  parse,
  type DefinitionNode,
  type DocumentNode,
  type OperationDefinitionNode,
} from 'graphql';
import { normalizeOperation as coreNormalizeOperation } from '@graphql-hive/core';

/** normalize a graphql operation into a stable hash as used internally within our ClickHouse Database. */
export function normalizeOperation(operation: {
  document: string;
  fields: Iterable<string>;
  operationName: string | null;
}) {
  let parsed: DocumentNode;
  try {
    parsed = parse(operation.document);
  } catch (error) {
    // No need to log this, it's already logged by the usage service
    // We do check for parse errors here (in addition to the usage service),
    // because the usage service was not parsing the operations before and we got corrupted documents in the Kafka loop.
    return null;
  }

  const body = coreNormalizeOperation({
    document: parsed,
    hideLiterals: true,
    removeAliases: true,
  });

  // Two operations with the same hash has to be equal:
  // 1. body is the same
  // 2. name is the same
  // 3. used schema coordinates are equal - this is important to assign schema coordinate to an operation

  const uniqueCoordinatesSet = new Set<string>();
  for (const field of operation.fields) {
    uniqueCoordinatesSet.add(field);
    // Add types as well:
    // `Query.foo` -> `Query`
    const at = field.indexOf('.');
    if (at > -1) {
      uniqueCoordinatesSet.add(field.substring(0, at));
    }
  }

  const sortedCoordinates = Array.from(uniqueCoordinatesSet).sort();

  const operationDefinition = findOperationDefinition(parsed);

  if (!operationDefinition) {
    return null;
  }

  const operationName = operation.operationName ?? operationDefinition.name?.value;

  const hash = createHash('md5')
    .update(body)
    .update(operationName ?? '')
    .update(sortedCoordinates.join(';')) // we do not need to sort from A to Z, default lexicographic sorting is enough
    .digest('hex');

  return {
    type: operationDefinition.operation,
    hash,
    body,
    coordinates: sortedCoordinates,
    name: operationName || null,
  };
}

function findOperationDefinition(doc: DocumentNode) {
  return doc.definitions.find(isOperationDef);
}

function isOperationDef(def: DefinitionNode): def is OperationDefinitionNode {
  return def.kind === Kind.OPERATION_DEFINITION;
}
