import {
  buildASTSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  Kind,
  specifiedScalarTypes,
  visit,
  type ConstDirectiveNode,
  type DocumentNode,
  type EnumTypeDefinitionNode,
  type GraphQLNamedType,
  type GraphQLType,
  type InputObjectTypeDefinitionNode,
  type InterfaceTypeDefinitionNode,
  type ObjectTypeDefinitionNode,
  type ScalarTypeDefinitionNode,
  type UnionTypeDefinitionNode,
} from 'graphql';

const specifiedScalarNames = new Set(specifiedScalarTypes.map(t => t.name));

/**
 * Retrieve a named list of all types that are reachable from the root types.
 */
export function getReachableTypes(documentNode: DocumentNode): Set<string> {
  const reachableTypeNames = new Set<string>();
  const schema = buildASTSchema(documentNode);
  const didVisitType = new Set<GraphQLType>();
  const typeQueue: Array<GraphQLNamedType> = [];

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();

  if (queryType) {
    processNamedType(queryType);
  }
  if (mutationType) {
    processNamedType(mutationType);
  }
  if (subscriptionType) {
    processNamedType(subscriptionType);
  }

  function processNamedType(tType: GraphQLNamedType) {
    if (didVisitType.has(tType) || specifiedScalarNames.has(tType.name)) {
      return;
    }
    didVisitType.add(tType);
    typeQueue.push(tType);
    reachableTypeNames.add(tType.name);
  }

  let currentType: GraphQLNamedType | undefined;

  while ((currentType = typeQueue.shift())) {
    if (isObjectType(currentType)) {
      for (const field of Object.values(currentType.getFields())) {
        const fieldType = getNamedType(field.type);
        processNamedType(fieldType);

        for (const arg of field.args) {
          const argType = getNamedType(arg.type);
          processNamedType(argType);
        }
      }
      currentType.getInterfaces().forEach(processNamedType);
    } else if (isInputObjectType(currentType)) {
      for (const field of Object.values(currentType.getFields())) {
        const fieldType = getNamedType(field.type);
        processNamedType(fieldType);
      }
    } else if (isScalarType(currentType) || isEnumType(currentType)) {
      reachableTypeNames.add(currentType.name);
    } else if (isInterfaceType(currentType)) {
      for (const field of Object.values(currentType.getFields())) {
        const fieldType = getNamedType(field.type);
        processNamedType(fieldType);
      }
      currentType.getInterfaces().forEach(processNamedType);
      schema.getPossibleTypes(currentType).forEach(processNamedType);
    } else if (isUnionType(currentType)) {
      currentType.getTypes().forEach(processNamedType);
    }
  }

  return reachableTypeNames;
}

/**
 * Creates a function that adds a directive with a given name to a list of directives if it does not exist yet.
 */
function createAddDirectiveIfNotExists(directiveName: string) {
  return function addDirectiveIfNotExists(
    directives?: readonly ConstDirectiveNode[],
  ): readonly ConstDirectiveNode[] | void {
    const hasInaccessibleDirective = !!directives?.some(
      directive => directive.name.value === directiveName,
    );

    if (!hasInaccessibleDirective) {
      return [
        ...(directives ?? []),
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: directiveName,
          },
        },
      ];
    }
    return directives;
  };
}

/**
 * For a given GraphQL schema document node, add a directive with a given name to all types not in the provided set.
 */
export function addDirectiveOnExcludedTypes(
  documentNode: DocumentNode,
  /** a set of excluded types. e.g. as retrieved from the `getReachableTypes` function. */
  typeNames: Set<string>,
  /** name of the directive that should be added on the types. */
  directiveName: string,
): DocumentNode {
  const addDirectiveIfNotExists = createAddDirectiveIfNotExists(directiveName);

  function onNamedTypeDefinitionNode(
    node:
      | ObjectTypeDefinitionNode
      | UnionTypeDefinitionNode
      | InterfaceTypeDefinitionNode
      | ScalarTypeDefinitionNode
      | EnumTypeDefinitionNode
      | InputObjectTypeDefinitionNode,
  ) {
    if (typeNames.has(node.name.value)) {
      return;
    }
    return {
      ...node,
      directives: addDirectiveIfNotExists(node.directives),
    };
  }

  return visit(documentNode, {
    [Kind.OBJECT_TYPE_DEFINITION]: onNamedTypeDefinitionNode,
    [Kind.INTERFACE_TYPE_DEFINITION]: onNamedTypeDefinitionNode,
    [Kind.UNION_TYPE_DEFINITION]: onNamedTypeDefinitionNode,
    [Kind.ENUM_TYPE_DEFINITION]: onNamedTypeDefinitionNode,
    [Kind.INPUT_OBJECT_TYPE_DEFINITION]: onNamedTypeDefinitionNode,
    [Kind.SCALAR_TYPE_DEFINITION]: onNamedTypeDefinitionNode,
  });
}
