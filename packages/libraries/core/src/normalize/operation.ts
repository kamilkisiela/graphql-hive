import {
  ArgumentNode,
  DefinitionNode,
  DirectiveNode,
  DocumentNode,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  print,
  SelectionNode,
  stripIgnoredCharacters,
  TypeInfo,
  VariableDefinitionNode,
  visit,
} from 'graphql';
import { md5 } from 'js-md5';
import sortBy from 'lodash.sortby';

/**
 * Normalize a operation document.
 */
export function normalizeOperation({
  document,
  hideLiterals = true,
  removeAliases = true,
}: {
  document: DocumentNode;
  hideLiterals?: boolean;
  removeAliases?: boolean;
}): string {
  return stripIgnoredCharacters(
    print(
      visit(document, {
        // hide literals
        IntValue(node) {
          return hideLiterals ? { ...node, value: '0' } : node;
        },
        FloatValue(node) {
          return hideLiterals ? { ...node, value: '0' } : node;
        },
        StringValue(node) {
          return hideLiterals ? { ...node, value: '', block: false } : node;
        },
        Field(node) {
          return {
            ...node,
            // remove aliases
            alias: removeAliases ? undefined : node.alias,
            // sort arguments
            arguments: sortNodes(node.arguments),
          };
        },
        Document(node) {
          return {
            ...node,
            definitions: sortNodes(node.definitions),
          };
        },
        OperationDefinition(node) {
          return {
            ...node,
            variableDefinitions: sortNodes(node.variableDefinitions),
          };
        },
        SelectionSet(node) {
          return {
            ...node,
            selections: sortNodes(node.selections),
          };
        },
        FragmentSpread(node) {
          return {
            ...node,
            directives: sortNodes(node.directives),
          };
        },
        InlineFragment(node) {
          return {
            ...node,
            directives: sortNodes(node.directives),
          };
        },
        FragmentDefinition(node) {
          return {
            ...node,
            directives: sortNodes(node.directives),
            variableDefinitions: sortNodes(node.variableDefinitions),
          };
        },
        Directive(node) {
          return { ...node, arguments: sortNodes(node.arguments) };
        },
      }),
    ),
  );
}

function sortNodes(nodes: readonly DefinitionNode[]): readonly DefinitionNode[];
function sortNodes(nodes: readonly SelectionNode[]): readonly SelectionNode[];
function sortNodes(nodes: readonly ArgumentNode[] | undefined): readonly ArgumentNode[] | undefined;
function sortNodes(
  nodes: readonly VariableDefinitionNode[] | undefined,
): readonly VariableDefinitionNode[] | undefined;
function sortNodes(
  nodes: readonly DirectiveNode[] | undefined,
): readonly DirectiveNode[] | undefined;
function sortNodes(nodes: readonly any[] | undefined): readonly any[] | undefined {
  if (nodes) {
    if (nodes.length === 0) {
      return [];
    }

    if (isOfKindList<DirectiveNode>(nodes, Kind.DIRECTIVE)) {
      return sortBy(nodes, 'name.value');
    }

    if (isOfKindList<VariableDefinitionNode>(nodes, Kind.VARIABLE_DEFINITION)) {
      return sortBy(nodes, 'variable.name.value');
    }

    if (isOfKindList<ArgumentNode>(nodes, Kind.ARGUMENT)) {
      return sortBy(nodes, 'name.value');
    }

    if (
      isOfKindList<SelectionNode>(nodes, [Kind.FIELD, Kind.FRAGMENT_SPREAD, Kind.INLINE_FRAGMENT])
    ) {
      return sortBy(nodes, 'kind', 'name.value');
    }

    return sortBy(nodes, 'kind', 'name.value');
  }

  return;
}

function isOfKindList<T>(nodes: readonly any[], kind: string | string[]): nodes is T[] {
  return typeof kind === 'string' ? nodes[0].kind === kind : kind.includes(nodes[0].kind);
}

function isOperationDef(def: DefinitionNode): def is OperationDefinitionNode {
  return def.kind === Kind.OPERATION_DEFINITION;
}

function findOperationDefinition(doc: DocumentNode) {
  return doc.definitions.find(isOperationDef);
}

export function hashOperationIdentity(operation: {
  body: string;
  operationName: string | null;
}): string {
  return md5.create().update(operation.body).update(operation.operationName ?? '').hex();
}

/** normalize a graphql operation into a stable hash as used internally within our ClickHouse Database. */
export function preprocessOperation(operation: {
  document: DocumentNode;
  schemaCoordinates: Iterable<string>;
  operationName: string | null;
}) {
  const body = normalizeOperation({
    document: operation.document,
    hideLiterals: true,
    removeAliases: true,
  });

  const uniqueCoordinatesSet = new Set<string>();
  for (const field of operation.schemaCoordinates) {
    uniqueCoordinatesSet.add(field);
    // Add types as well:
    // `Query.foo` -> `Query`
    const at = field.indexOf('.');
    if (at > -1) {
      uniqueCoordinatesSet.add(field.substring(0, at));
    }
  }

  const sortedCoordinates = Array.from(uniqueCoordinatesSet).sort();

  const operationDefinition = findOperationDefinition(operation.document);

  if (!operationDefinition) {
    return null;
  }

  const operationName = operation.operationName ?? operationDefinition.name?.value;

  const hash = hashOperationIdentity({ body, operationName: operationName ?? null });

  return {
    type: operationDefinition.operation,
    hash,
    body,
    coordinates: sortedCoordinates,
    name: operationName || null,
  };
}

/**
 * Hash a executable GraphQL document according to Hive platforms algorithm
 * for identification.
 *
 * Return null if no executable operation definition was found.
 */
export function hashOperation(args: {
  documentNode: DocumentNode;
  variables: null | {
    [key: string]: unknown;
  };
  operationName: string | null;
  schema: GraphQLSchema;
  typeInfo?: TypeInfo;
}) {
  const result = preprocessOperation({
    document: args.documentNode,
    schemaCoordinates: [],
    operationName: args.operationName,
  });

  return result?.hash ?? null;
}
