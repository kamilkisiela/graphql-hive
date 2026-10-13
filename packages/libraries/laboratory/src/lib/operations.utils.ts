import {
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  isAbstractType,
  isInterfaceType,
  isObjectType,
  isUnionType,
  Kind,
  OperationTypeNode,
  parse,
  print,
  type ArgumentNode,
  type DefinitionNode,
  type DocumentNode,
  type FieldNode,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLOutputType,
  type InlineFragmentNode,
  type OperationDefinitionNode,
  type SelectionNode,
  type SelectionSetNode,
  type VariableDefinitionNode,
} from 'graphql';
import { get } from 'lodash';
import type { LaboratoryOperation } from './operations';
import {
  decodeTypeConditionSegment,
  encodeTypeConditionSegment,
  resolveSchemaPath,
} from './schema-path';

export function healQuery(query: string) {
  return query.replace(/\{(\s+)?\}/g, '');
}

const createSelection = (segment: string): FieldNode | InlineFragmentNode => {
  const typeName = decodeTypeConditionSegment(segment);

  if (typeName === null) {
    return { kind: Kind.FIELD, name: { kind: Kind.NAME, value: segment } };
  }

  return {
    kind: Kind.INLINE_FRAGMENT,
    typeCondition: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: typeName } },
    // An inline fragment with no selections prints as `... on X`, with no braces,
    // which does not parse. Every walker swallows a parse failure and no-ops, so
    // one of these would freeze the whole builder.
    selectionSet: { kind: Kind.SELECTION_SET, selections: [] },
  };
};

type SelectionStep = { parent: SelectionSetNode; node: FieldNode | InlineFragmentNode };

/**
 * Finds the selection one segment addresses, along with the selection set that
 * actually holds it, which is what a later removal has to filter.
 */
const locateSelection = (
  selectionSet: SelectionSetNode,
  segment: string,
): SelectionStep | undefined => {
  const typeName = decodeTypeConditionSegment(segment);

  for (const selection of selectionSet.selections) {
    if (typeName === null) {
      if (selection.kind === Kind.FIELD && selection.name.value === segment) {
        return { parent: selectionSet, node: selection };
      }
    } else if (
      selection.kind === Kind.INLINE_FRAGMENT &&
      selection.typeCondition?.name.value === typeName
    ) {
      return { parent: selectionSet, node: selection };
    }
  }

  // Only after a direct match fails: a fragment with no type condition is not a
  // level of its own, so what it holds is addressable at this same path.
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.INLINE_FRAGMENT && !selection.typeCondition) {
      const found = locateSelection(selection.selectionSet, segment);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
};

const asSelections = (selectionSet: SelectionSetNode) => selectionSet.selections as SelectionNode[];

/**
 * Walks a path's segments down an operation's selections, one step per segment.
 *
 * Anchored at the operation root rather than matching a field name wherever it
 * turns up, so the same name at two depths cannot be confused, and a type
 * condition is a step of its own rather than something to see through. With
 * `create`, missing nodes are added on the way down.
 */
function descendSelections(
  operationDefinition: OperationDefinitionNode,
  segments: string[],
  create = false,
): SelectionStep[] | null {
  if (segments.length === 0) {
    return null;
  }

  if (!operationDefinition.selectionSet) {
    if (!create) {
      return null;
    }

    (operationDefinition as { selectionSet: SelectionSetNode }).selectionSet = {
      kind: Kind.SELECTION_SET,
      selections: [],
    };
  }

  let parent = operationDefinition.selectionSet;
  const steps: SelectionStep[] = [];

  for (let i = 0; i < segments.length; ++i) {
    let step = locateSelection(parent, segments[i]);

    if (!step) {
      if (!create) {
        return null;
      }

      const created = createSelection(segments[i]);

      asSelections(parent).push(created);
      step = { parent, node: created };
    }

    const { node } = step;

    steps.push(step);

    if (i === segments.length - 1) {
      break;
    }

    if (!node.selectionSet) {
      if (!create) {
        return null;
      }

      (node as { selectionSet: SelectionSetNode }).selectionSet = {
        kind: Kind.SELECTION_SET,
        selections: [],
      };
    }

    parent = node.selectionSet as SelectionSetNode;
  }

  return steps;
}

/**
 * An abstract field selects nothing on its own, so a selection set holding only
 * `__typename` is the smallest valid thing the builder can write for one. Seeding
 * it on the way in means the document is never momentarily invalid, and it is
 * what keeps the set non-empty as branches come and go.
 */
const ensureTypename = (node: FieldNode | InlineFragmentNode) => {
  if (!node.selectionSet) {
    (node as { selectionSet: SelectionSetNode }).selectionSet = {
      kind: Kind.SELECTION_SET,
      selections: [],
    };
  }

  const selectionSet = node.selectionSet as SelectionSetNode;

  const hasTypename = selectionSet.selections.some(
    selection => selection.kind === Kind.FIELD && selection.name.value === '__typename',
  );

  if (!hasTypename) {
    asSelections(selectionSet).unshift({
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: '__typename' },
    });
  }
};

const removeSelection = (parent: SelectionSetNode, node: SelectionNode) => {
  (parent as { selections: readonly SelectionNode[] }).selections = parent.selections.filter(
    selection => selection !== node,
  );
};

export function isPathInQuery(query: string, path: string, operationName?: string | null) {
  if (!query || !path) {
    return false;
  }

  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {
    // console.error(error);
  }

  if (!doc) {
    return false;
  }

  const operationDefinition: OperationDefinitionNode = doc.definitions.find(v => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return false;
  }

  if (segments.length === 0) {
    return true;
  }

  return descendSelections(operationDefinition, segments) !== null;
}

export function addPathToQuery(
  query: string,
  path: string,
  operationName?: string | null,
  schema?: GraphQLSchema,
) {
  query = healQuery(query);

  const [operation, ...parts] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {
    // console.error(error);
  }

  doc ??= {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation,
        name: {
          kind: Kind.NAME,
          value: 'Untitled',
        },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [],
        },
      },
    ],
  };

  let operationDefinition: OperationDefinitionNode = doc.definitions.find(v => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    operationDefinition = {
      kind: Kind.OPERATION_DEFINITION,
      operation,
      name: {
        kind: Kind.NAME,
        value: 'Untitled',
      },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [],
      },
    };

    (doc.definitions as DefinitionNode[]).push(operationDefinition);
  }

  if (parts.length === 0) {
    return print(doc)
      .split('\n')
      .map(v => {
        if (v.includes(`${operation} Untitled`)) {
          return v + ' {}';
        }

        return v;
      })
      .join('\n');
  }

  const steps = descendSelections(operationDefinition, parts, true);
  const schemaSteps = schema ? resolveSchemaPath(path, schema) : null;

  if (steps && schemaSteps) {
    // A type-condition step resolves to its concrete member, so `__typename`
    // lands on the abstract parent rather than inside each branch.
    steps.forEach((step, i) => {
      if (schemaSteps[i] && isAbstractType(schemaSteps[i].type)) {
        ensureTypename(step.node);
      }
    });
  }

  return print(doc);
}

export function deletePathFromQuery(query: string, path: string, operationName?: string | null) {
  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {
    // console.error(error);
  }

  if (!doc) {
    return query;
  }

  let operationDefinition: OperationDefinitionNode = doc.definitions.find(v => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return query;
  }

  const steps = descendSelections(operationDefinition, segments);

  if (steps) {
    const last = steps[steps.length - 1];

    removeSelection(last.parent, last.node);

    // An inline fragment left holding nothing prints as `... on X`, with no
    // braces, which does not parse. Prune from the inside out, stopping at the
    // first ancestor that still has selections of its own.
    for (let i = steps.length - 2; i >= 0; --i) {
      const { parent, node } = steps[i];

      if (node.kind !== Kind.INLINE_FRAGMENT || node.selectionSet.selections.length > 0) {
        break;
      }

      removeSelection(parent, node);
    }
  }

  const isOperationSelectionSetEmpty = operationDefinition.selectionSet?.selections.length === 0;

  if (isOperationSelectionSetEmpty) {
    if (doc.definitions.length > 1) {
      return `${print({ ...doc, definitions: doc.definitions.filter(v => v !== operationDefinition) })}
${operation} ${operationDefinition.name?.value} {}`;
    }

    return `${operation} ${operationDefinition.name?.value} {}`;
  }

  operationDefinition = doc.definitions.find(v => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  return print(doc);
}

export async function getOperationHash(
  operation: Pick<LaboratoryOperation, 'query' | 'variables'>,
) {
  try {
    const canonicalQuery = print(parse(operation.query));
    const canonicalVariables = '';
    const canonical = `${canonicalQuery}\n${canonicalVariables}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  } catch {
    // console.error(error);
    return null;
  }
}

export function getOperationName(query: string) {
  try {
    const doc = parse(query);
    const operationDefinition = doc.definitions.find(v => v.kind === Kind.OPERATION_DEFINITION);
    return operationDefinition?.name?.value;
  } catch {
    // console.error(error);

    const match = query.match(/(query|mutation|subscription)\s+([a-zA-Z0-9_]+)/);

    return match ? match[2] : null;
  }
}

export function getOperationType(query: string) {
  try {
    const doc = parse(query);
    const operationDefinition = doc.definitions.find(v => v.kind === Kind.OPERATION_DEFINITION);
    return operationDefinition?.operation;
  } catch {
    return null;
  }
}

export function isArgInQuery(
  query: string,
  path: string,
  argName: string,
  operationName?: string | null,
) {
  if (!query || !path) {
    return false;
  }

  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {
    // console.error(error);
  }

  if (!doc) {
    return false;
  }

  const operationDefinition: OperationDefinitionNode = doc.definitions.find(v => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return false;
  }

  const node = descendSelections(operationDefinition, segments)?.at(-1)?.node;

  if (node?.kind !== Kind.FIELD) {
    return false;
  }

  return node.arguments?.some(v => v.name.value === argName) ?? false;
}

export function addArgToField(
  query: string,
  path: string,
  argName: string,
  schema: GraphQLSchema,
  operationName?: string | null,
) {
  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {
    // console.error(error);
  }

  doc ||= {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation,
        name: {
          kind: Kind.NAME,
          value: 'NewOperation',
        },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [],
        },
      },
    ],
  };

  let operationDefinition: OperationDefinitionNode = doc.definitions.find(v => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    operationDefinition = {
      kind: Kind.OPERATION_DEFINITION,
      operation,
      name: {
        kind: Kind.NAME,
        value: 'NewOperation',
      },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [],
      },
    };

    (doc.definitions as DefinitionNode[]).push(operationDefinition);
  }

  query = print(doc);

  if (!isPathInQuery(query, path, operationName)) {
    doc = parse(addPathToQuery(query, path, operationName, schema));

    operationDefinition = doc.definitions.find(v => {
      if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
        if (operationName) {
          return v.name?.value === operationName;
        }

        return true;
      }

      return false;
    }) as OperationDefinitionNode;
  }

  const fieldNode = descendSelections(operationDefinition, segments)?.at(-1)?.node;
  const arg = getFieldByPath(path, schema)?.args.find(v => v.name === argName);

  if (fieldNode?.kind !== Kind.FIELD || !arg) {
    return print(doc);
  }

  const variableDefinitions = ((
    operationDefinition as { variableDefinitions?: unknown }
  ).variableDefinitions ||= []) as VariableDefinitionNode[];

  let variableName = arg.name;
  let i = 2;

  while (variableDefinitions.find(v => v.variable.name.value === variableName)) {
    variableName = arg.name + i;
    ++i;
  }

  variableDefinitions.push({
    kind: Kind.VARIABLE_DEFINITION,
    variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: variableName } },
    type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: arg.type.toString() } },
  });

  const args = ((fieldNode as { arguments?: unknown }).arguments ||= []) as ArgumentNode[];

  args.push({
    kind: Kind.ARGUMENT,
    name: { kind: Kind.NAME, value: argName },
    value: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: variableName } },
  });

  return print(doc);
}

export function removeArgFromField(
  query: string,
  path: string,
  argName: string,
  operationName?: string | null,
) {
  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {
    // console.error(error);
  }

  if (!doc) {
    return query;
  }

  const operationDefinition: OperationDefinitionNode = doc.definitions.find(v => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return query;
  }

  const fieldNode = descendSelections(operationDefinition, segments)?.at(-1)?.node;

  if (fieldNode?.kind === Kind.FIELD && fieldNode.arguments) {
    (fieldNode as { arguments: readonly ArgumentNode[] }).arguments = fieldNode.arguments.filter(
      v => v.name.value !== argName,
    );
  }

  return print(doc);
}

export function extractPaths(query: string): string[][] {
  try {
    const ast = parse(query);
    const paths: string[][] = [
      [
        ast.definitions[0].kind === Kind.OPERATION_DEFINITION
          ? ast.definitions[0].operation
          : 'query',
      ],
    ];

    const traverse = (selections: readonly SelectionNode[], currentPath: string[] = []) => {
      for (const selection of selections) {
        if (selection.kind === Kind.FIELD) {
          const newPath = [...currentPath, selection.name.value];
          paths.push(newPath);

          if (selection.selectionSet) {
            traverse(selection.selectionSet.selections, newPath);
          }

          continue;
        }

        if (selection.kind === Kind.INLINE_FRAGMENT) {
          // A fragment with no type condition adds no level, so its fields stay
          // addressable at the parent's path.
          const newPath = selection.typeCondition
            ? [...currentPath, encodeTypeConditionSegment(selection.typeCondition.name.value)]
            : currentPath;

          if (selection.typeCondition) {
            paths.push(newPath);
          }

          traverse(selection.selectionSet.selections, newPath);
        }
      }
    };

    for (const def of ast.definitions) {
      if (def.kind === 'OperationDefinition' && def.selectionSet) {
        traverse(def.selectionSet.selections, paths[0]);
      }
    }

    return paths;
  } catch {
    return [];
  }
}

export function getOpenPaths(query: string): string[] {
  return extractPaths(query).map(v => v.join('.'));
}

/**
 * Folds the paths a document implies into the paths the builder already has open.
 *
 * Every edit rewrites the document, including a checkbox toggle, so replacing the
 * open paths outright would throw away whatever the user expanded by hand. Paths the
 * previous document contributed and this one does not are collapsed; the rest stay.
 * Returns `current` untouched when nothing moved, so callers can skip a re-render.
 */
export function mergeOpenPaths(
  current: string[],
  previousDocumentPaths: string[],
  documentPaths: string[],
): string[] {
  const next = new Set(current);

  for (const path of previousDocumentPaths) {
    if (!documentPaths.includes(path)) {
      next.delete(path);
    }
  }

  for (const path of documentPaths) {
    next.add(path);
  }

  if (next.size === current.length && current.every(path => next.has(path))) {
    return current;
  }

  return [...next];
}

type SearchableFieldType = GraphQLObjectType | GraphQLInterfaceType;

export type SchemaPathSearchEntry = {
  path: string;
  segmentsLower: string[];
  pathLower: string;
  pathWithoutOperationLower: string;
};

export type SchemaSearchResult = {
  matchedPaths: string[];
  visiblePaths: Set<string>;
  forcedOpenPaths: Set<string>;
  hasMore: boolean;
  nodesVisited: number;
};

function unwrapNamedType(type: GraphQLOutputType): GraphQLNamedType {
  if (type instanceof GraphQLNonNull || type instanceof GraphQLList) {
    return unwrapNamedType(type.ofType);
  }

  return type;
}

function isSearchableFieldType(type: GraphQLNamedType): type is SearchableFieldType {
  return type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType;
}

function isLeafFieldType(type: GraphQLNamedType): boolean {
  return (
    type instanceof GraphQLScalarType ||
    type instanceof GraphQLEnumType ||
    type instanceof GraphQLUnionType
  );
}

function collectOperationPaths(
  operation: OperationTypeNode,
  rootType: SearchableFieldType,
  result: string[][],
  maxDepth: number,
) {
  const rootFields = Object.values(rootType.getFields());
  const pathBuffer: string[] = [operation];

  const walk = (field: GraphQLField<unknown, unknown, unknown>, seenTypes: Set<string>) => {
    pathBuffer.push(field.name);
    result.push([...pathBuffer]);

    if (pathBuffer.length >= maxDepth + 1) {
      pathBuffer.pop();
      return;
    }

    const namedType = unwrapNamedType(field.type);

    if (isLeafFieldType(namedType) || !isSearchableFieldType(namedType)) {
      pathBuffer.pop();
      return;
    }

    if (seenTypes.has(namedType.name)) {
      pathBuffer.pop();
      return;
    }

    const nextSeenTypes = new Set(seenTypes);
    nextSeenTypes.add(namedType.name);

    for (const childField of Object.values(namedType.getFields())) {
      walk(childField, nextSeenTypes);
    }

    pathBuffer.pop();
  };

  for (const rootField of rootFields) {
    walk(rootField, new Set([rootType.name]));
  }
}

export function schemaToPaths(schema: GraphQLSchema, maxDepth = 8): string[][] {
  const result: string[][] = [];

  const operationTypes: [OperationTypeNode, SearchableFieldType | null][] = [
    [OperationTypeNode.QUERY, schema.getQueryType() ?? null],
    [OperationTypeNode.MUTATION, schema.getMutationType() ?? null],
    [OperationTypeNode.SUBSCRIPTION, schema.getSubscriptionType() ?? null],
  ];

  for (const [operation, rootType] of operationTypes) {
    if (!rootType) {
      continue;
    }

    collectOperationPaths(operation, rootType, result, maxDepth);
  }

  return result;
}

export function pathsToStrings(paths: readonly string[][]): string[] {
  return paths.map(path => path.join('.'));
}

export function createSchemaPathSearchIndex(paths: readonly string[]): SchemaPathSearchEntry[] {
  return paths.map(path => {
    const segments = path.split('.');
    const segmentsLower = segments.map(segment => segment.toLowerCase());

    return {
      path,
      segmentsLower,
      pathLower: path.toLowerCase(),
      pathWithoutOperationLower: segmentsLower.slice(1).join('.'),
    };
  });
}

function matchesDottedSearch(entry: SchemaPathSearchEntry, searchSegments: string[]): boolean {
  const segmentsLower = entry.segmentsLower;
  const maxStart = segmentsLower.length - searchSegments.length;

  if (maxStart < 1) {
    return false;
  }

  for (let start = 1; start <= maxStart; ++start) {
    let matches = true;

    for (let i = 0; i < searchSegments.length; ++i) {
      if (!segmentsLower[start + i].includes(searchSegments[i])) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
}

export function searchSchemaPathIndex(
  index: readonly SchemaPathSearchEntry[],
  search: string,
  limit = 1000,
): string[] {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return [];
  }

  const searchSegments = normalizedSearch.split('.').filter(Boolean);
  const useSegmentSearch = searchSegments.length > 1;
  const result: string[] = [];

  for (const entry of index) {
    const isMatch = useSegmentSearch
      ? matchesDottedSearch(entry, searchSegments)
      : entry.pathWithoutOperationLower.includes(normalizedSearch) ||
        entry.pathLower.includes(normalizedSearch);

    if (!isMatch) {
      continue;
    }

    result.push(entry.path);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export function buildVisiblePathSet(paths: readonly string[]): Set<string> {
  const result = new Set<string>();

  for (const path of paths) {
    let dotIndex = path.indexOf('.');

    while (dotIndex !== -1) {
      result.add(path.slice(0, dotIndex));
      dotIndex = path.indexOf('.', dotIndex + 1);
    }

    result.add(path);
  }

  return result;
}

export function buildForcedOpenPathSet(paths: readonly string[]): Set<string> {
  const result = new Set<string>();

  for (const path of paths) {
    let dotIndex = path.indexOf('.');

    while (dotIndex !== -1) {
      result.add(path.slice(0, dotIndex));
      dotIndex = path.indexOf('.', dotIndex + 1);
    }
  }

  return result;
}

function matchSearchAgainstPath(
  pathSegmentsLower: readonly string[],
  normalizedSearch: string,
  searchSegments: readonly string[],
): boolean {
  if (searchSegments.length > 1) {
    const maxStart = pathSegmentsLower.length - searchSegments.length;

    if (maxStart < 0) {
      return false;
    }

    for (let start = 0; start <= maxStart; ++start) {
      let matched = true;

      for (let i = 0; i < searchSegments.length; ++i) {
        if (!pathSegmentsLower[start + i].includes(searchSegments[i])) {
          matched = false;
          break;
        }
      }

      if (matched) {
        return true;
      }
    }

    return false;
  }

  for (const segment of pathSegmentsLower) {
    if (segment.includes(normalizedSearch)) {
      return true;
    }
  }

  return false;
}

export function searchSchemaPaths(
  schema: GraphQLSchema,
  search: string,
  options?: {
    maxDepth?: number;
    maxMatches?: number;
    maxNodes?: number;
    operationTypes?: OperationTypeNode[];
  },
): SchemaSearchResult {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return {
      matchedPaths: [],
      visiblePaths: new Set(),
      forcedOpenPaths: new Set(),
      hasMore: false,
      nodesVisited: 0,
    };
  }

  const maxDepth = options?.maxDepth ?? 8;
  const maxMatches = options?.maxMatches ?? 500;
  const maxNodes = options?.maxNodes ?? 40000;
  const searchSegments = normalizedSearch.split('.').filter(Boolean);
  const matchedPaths: string[] = [];
  const visiblePaths = new Set<string>();
  const forcedOpenPaths = new Set<string>();

  type Frame = {
    operation: OperationTypeNode;
    field: GraphQLField<unknown, unknown, unknown>;
    /** Full path, which may carry `on:Type` segments. */
    pathSegments: string[];
    /**
     * Field names only. Matching runs against these so a search for "on" or for a
     * type's own name cannot hit every field inside a branch by way of the sigil.
     */
    fieldSegments: string[];
    typeTrail: string[];
    depth: number;
  };

  const queue: Frame[] = [];
  let queueIndex = 0;

  const operationTypes: [OperationTypeNode, SearchableFieldType | null][] = [
    [OperationTypeNode.QUERY, schema.getQueryType() ?? null],
    [OperationTypeNode.MUTATION, schema.getMutationType() ?? null],
    [OperationTypeNode.SUBSCRIPTION, schema.getSubscriptionType() ?? null],
  ];

  const filteredOperationTypes =
    options?.operationTypes && options.operationTypes.length > 0
      ? operationTypes.filter(([operation]) => options.operationTypes!.includes(operation))
      : operationTypes;

  for (const [operation, rootType] of filteredOperationTypes) {
    if (!rootType) {
      continue;
    }

    for (const rootField of Object.values(rootType.getFields())) {
      queue.push({
        operation,
        field: rootField,
        pathSegments: [rootField.name],
        fieldSegments: [rootField.name],
        typeTrail: [rootType.name],
        depth: 1,
      });
    }
  }

  let nodesVisited = 0;
  let hasMore = false;

  while (queueIndex < queue.length) {
    if (nodesVisited >= maxNodes || matchedPaths.length >= maxMatches) {
      hasMore = true;
      break;
    }

    const frame = queue[queueIndex++] as Frame;
    ++nodesVisited;

    const path = `${frame.operation}.${frame.pathSegments.join('.')}`;
    const fieldSegmentsLower = frame.fieldSegments.map(segment => segment.toLowerCase());

    if (matchSearchAgainstPath(fieldSegmentsLower, normalizedSearch, searchSegments)) {
      matchedPaths.push(path);
      visiblePaths.add(path);

      let dotIndex = path.indexOf('.');

      while (dotIndex !== -1) {
        const parentPath = path.slice(0, dotIndex);
        visiblePaths.add(parentPath);
        forcedOpenPaths.add(parentPath);
        dotIndex = path.indexOf('.', dotIndex + 1);
      }
    }

    if (frame.depth >= maxDepth) {
      continue;
    }

    const namedType = unwrapNamedType(frame.field.type);

    if (frame.typeTrail.includes(namedType.name)) {
      continue;
    }

    const nextTrail = [...frame.typeTrail, namedType.name];

    const enqueue = (
      childField: GraphQLField<unknown, unknown, unknown>,
      branch: GraphQLObjectType | null,
      typeTrail: string[],
    ) => {
      queue.push({
        operation: frame.operation,
        field: childField,
        pathSegments: branch
          ? [...frame.pathSegments, encodeTypeConditionSegment(branch.name), childField.name]
          : [...frame.pathSegments, childField.name],
        fieldSegments: [...frame.fieldSegments, childField.name],
        typeTrail,
        depth: frame.depth + 1,
      });
    };

    if (isObjectType(namedType) || isInterfaceType(namedType)) {
      for (const childField of Object.values(namedType.getFields())) {
        enqueue(childField, null, nextTrail);
      }
    }

    // A type condition is a branch, not a schema level, so reaching a member field
    // costs the same depth budget as reaching a field of an object type would.
    const possibleTypes = isUnionType(namedType)
      ? namedType.getTypes()
      : isInterfaceType(namedType)
        ? schema.getPossibleTypes(namedType)
        : [];

    // The rows above already carry what the interface itself declares.
    const inherited = isInterfaceType(namedType)
      ? new Set(Object.keys(namedType.getFields()))
      : null;

    for (const possibleType of possibleTypes) {
      if (frame.typeTrail.includes(possibleType.name)) {
        continue;
      }

      const branchTrail = [...nextTrail, possibleType.name];

      for (const childField of Object.values(possibleType.getFields())) {
        if (!inherited?.has(childField.name)) {
          enqueue(childField, possibleType, branchTrail);
        }
      }
    }
  }

  return {
    matchedPaths,
    visiblePaths,
    forcedOpenPaths,
    hasMore,
    nodesVisited,
  };
}

/** Later headers replace earlier ones by name, compared case-insensitively. */
export function mergeHeaders(
  base: Record<string, string>,
  override: Record<string, string>,
): Record<string, string> {
  const overridden = new Set(Object.keys(override).map(name => name.toLowerCase()));

  return {
    ...Object.fromEntries(
      Object.entries(base).filter(([name]) => !overridden.has(name.toLowerCase())),
    ),
    ...override,
  };
}

export function handleTemplate(query: string, env: Record<string, any>) {
  return query.replace(/\{\{(.*?)\}\}/g, (match, p1) => {
    return get(env, p1) ?? match;
  });
}

/**
 * The field a path names, or null if the path does not resolve.
 *
 * A path ending in a type condition names no field of its own, so the nearest
 * enclosing field is returned instead: that is the abstract field the branch
 * narrows, which is what a caller holding such a path is asking about.
 */
export function getFieldByPath(path: string, schema: GraphQLSchema) {
  const steps = resolveSchemaPath(path, schema);

  if (!steps) {
    return null;
  }

  for (let i = steps.length - 1; i >= 0; --i) {
    const { field } = steps[i];

    if (field) {
      return field;
    }
  }

  return null;
}
