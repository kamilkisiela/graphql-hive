import {
  getNamedType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  isInterfaceType,
  isObjectType,
  SelectionNode,
} from 'graphql';

export function isFieldRequestedDeep(
  info: GraphQLResolveInfo,
  /**
   * Looks for any of the target fields. This could be further optimized
   * to return an array of match conditions, but for the current use case
   * it really only matters if any of these fields are requested.
   */
  targetFields: ReadonlyArray<readonly [string, string]>,
): boolean {
  // Organize targets for O(1) lookups: Map<TypeName, Set<FieldName>>
  const targetMap = new Map<string, Set<string>>();
  for (const [typeName, fieldName] of targetFields) {
    let fields = targetMap.get(typeName);
    if (!fields) {
      fields = new Set();
      targetMap.set(typeName, fields);
    }
    fields.add(fieldName);
  }

  let found = false;

  function visitSelections(selections: readonly SelectionNode[], parentType: GraphQLOutputType) {
    if (found) return; // Short-circuit if already found

    // getNamedType unwraps GraphQLNonNull and GraphQLList wrappers
    const namedType = getNamedType(parentType);
    const typeName = namedType.name;

    for (const selection of selections) {
      if (selection.kind === 'Field') {
        const fieldName = selection.name.value;

        // 1. Check if the current type context and field name match our targets
        if (targetMap.get(typeName)?.has(fieldName)) {
          found = true;
          return;
        }

        // 2. Traverse deeper if there is a nested selection set
        if (selection.selectionSet && (isObjectType(namedType) || isInterfaceType(namedType))) {
          const fieldDef = namedType.getFields()[fieldName];
          if (fieldDef) {
            visitSelections(selection.selectionSet.selections, fieldDef.type);
          }
        }
      } else if (selection.kind === 'InlineFragment') {
        // Adjust the type context based on the inline fragment's "... on TypeName"
        let fragmentType = parentType;
        if (selection.typeCondition) {
          const conditionName = selection.typeCondition.name.value;
          const schemaType = info.schema.getType(conditionName);
          if (schemaType) {
            fragmentType = schemaType as GraphQLOutputType;
          }
        }

        if (selection.selectionSet) {
          visitSelections(selection.selectionSet.selections, fragmentType);
        }
      } else if (selection.kind === 'FragmentSpread') {
        // Look up the fragment definition to get its type condition and selection set
        const fragment = info.fragments[selection.name.value];
        if (fragment && fragment.selectionSet) {
          const conditionName = fragment.typeCondition.name.value;
          const schemaType = info.schema.getType(conditionName);
          const spreadType = (schemaType as GraphQLOutputType) || parentType;

          visitSelections(fragment.selectionSet.selections, spreadType);
        }
      }
    }
  }

  // Start the traversal from the resolver's return type
  for (const fieldNode of info.fieldNodes) {
    if (fieldNode.selectionSet) {
      visitSelections(fieldNode.selectionSet.selections, info.returnType);
    }
  }

  return found;
}
