import { ASTNode, Kind, parse, print, visit } from 'graphql';

type NamedNode = { kind: string; name?: { value: string } };

// Which child lists to sort, per definition kind. Explicit, so values whose order is meaningful
// (list default values, directive arguments) are left alone.
const SORTED_LISTS: Partial<Record<Kind, string[]>> = {
  [Kind.SCHEMA_DEFINITION]: ['directives', 'operationTypes'],
  [Kind.SCHEMA_EXTENSION]: ['directives', 'operationTypes'],
  [Kind.SCALAR_TYPE_DEFINITION]: ['directives'],
  [Kind.SCALAR_TYPE_EXTENSION]: ['directives'],
  [Kind.OBJECT_TYPE_DEFINITION]: ['directives', 'fields', 'interfaces'],
  [Kind.OBJECT_TYPE_EXTENSION]: ['directives', 'fields', 'interfaces'],
  [Kind.INTERFACE_TYPE_DEFINITION]: ['directives', 'fields', 'interfaces'],
  [Kind.INTERFACE_TYPE_EXTENSION]: ['directives', 'fields', 'interfaces'],
  [Kind.UNION_TYPE_DEFINITION]: ['directives', 'types'],
  [Kind.UNION_TYPE_EXTENSION]: ['directives', 'types'],
  [Kind.ENUM_TYPE_DEFINITION]: ['directives', 'values'],
  [Kind.ENUM_TYPE_EXTENSION]: ['directives', 'values'],
  [Kind.INPUT_OBJECT_TYPE_DEFINITION]: ['directives', 'fields'],
  [Kind.INPUT_OBJECT_TYPE_EXTENSION]: ['directives', 'fields'],
  [Kind.DIRECTIVE_DEFINITION]: ['arguments'],
  [Kind.FIELD_DEFINITION]: ['arguments', 'directives'],
  [Kind.INPUT_VALUE_DEFINITION]: ['directives'],
  [Kind.ENUM_VALUE_DEFINITION]: ['directives'],
};

// The schema definition and directive definitions lead, as they do in a printed schema.
function definitionRank(kind: string) {
  if (kind === Kind.SCHEMA_DEFINITION || kind === Kind.SCHEMA_EXTENSION) {
    return 0;
  }
  return kind === Kind.DIRECTIVE_DEFINITION ? 1 : 2;
}

// Code-unit order, not localeCompare: the same on every machine, and cheaper on large schemas.
function compareStrings(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareNodes(a: NamedNode, b: NamedNode) {
  return (
    definitionRank(a.kind) - definitionRank(b.kind) ||
    compareStrings(a.kind, b.kind) ||
    compareStrings(a.name?.value ?? '', b.name?.value ?? '')
  );
}

function compareOperationTypes(a: { operation: string }, b: { operation: string }) {
  return compareStrings(a.operation, b.operation);
}

/**
 * Prints the SDL with definitions, fields, arguments, enum values and directives sorted by kind
 * and name, so two schemas that differ only in order print the same. Mirrors the sort the API
 * applies before its own schema diff. Returns the input unchanged if it does not parse.
 */
export function sortSdl(sdl: string): string {
  let document;
  try {
    document = parse(sdl, { noLocation: true });
  } catch {
    return sdl;
  }

  const sorted = visit(document, {
    enter(node: ASTNode) {
      if (node.kind === Kind.DOCUMENT) {
        return { ...node, definitions: [...node.definitions].sort(compareNodes) };
      }
      const keys = SORTED_LISTS[node.kind];
      if (!keys) {
        return undefined;
      }
      const next: Record<string, unknown> = { ...node };
      for (const key of keys) {
        const list = next[key];
        if (Array.isArray(list)) {
          next[key] = [...list].sort(
            key === 'operationTypes' ? compareOperationTypes : compareNodes,
          );
        }
      }
      return next;
    },
  });

  return print(sorted);
}
