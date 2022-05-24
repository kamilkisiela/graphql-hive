import {
  visit,
  print,
  stripIgnoredCharacters,
  separateOperations,
  Kind,
  DocumentNode,
  DefinitionNode,
  OperationDefinitionNode,
  ArgumentNode,
  VariableDefinitionNode,
  SelectionNode,
  DirectiveNode,
} from 'graphql';
import sortBy from 'lodash.sortby';

export function normalizeOperation({
  document,
  operationName,
  hideLiterals = true,
  removeAliases = true,
}: {
  document: DocumentNode;
  hideLiterals?: boolean;
  removeAliases?: boolean;
  operationName?: string;
}): string {
  return stripIgnoredCharacters(
    print(
      visit(dropUnusedDefinitions(document, operationName ?? document.definitions.find(isOperationDef)?.name?.value), {
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
      })
    )
  );
}

function sortNodes(nodes: readonly DefinitionNode[]): readonly DefinitionNode[];
function sortNodes(nodes: readonly SelectionNode[]): readonly SelectionNode[];
function sortNodes(nodes: readonly ArgumentNode[] | undefined): readonly ArgumentNode[] | undefined;
function sortNodes(nodes: readonly VariableDefinitionNode[] | undefined): readonly VariableDefinitionNode[] | undefined;
function sortNodes(nodes: readonly DirectiveNode[] | undefined): readonly DirectiveNode[] | undefined;
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

    if (isOfKindList<SelectionNode>(nodes, [Kind.FIELD, Kind.FRAGMENT_SPREAD, Kind.INLINE_FRAGMENT])) {
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

function dropUnusedDefinitions(doc: DocumentNode, operationName?: string) {
  if (!operationName) {
    return doc;
  }

  return separateOperations(doc)[operationName] ?? doc;
}
