import {
  ArgumentNode,
  ASTNode,
  DocumentNode,
  getNamedType,
  GraphQLEnumType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLType,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isScalarType,
  Kind,
  NameNode,
  ObjectFieldNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql';

/** Collect all schema coordinates within a DocumentNode */
export function collectSchemaCoordinates(args: {
  documentNode: DocumentNode;
  variables: {
    [key: string]: unknown;
  } | null;
  processVariables: boolean;
  schema: GraphQLSchema;
  typeInfo: TypeInfo;
}) {
  const { variables } = args;
  const entries = new Set<string>();
  const collected_entire_named_types = new Set<string>();
  const shouldAnalyzeVariableValues = args.processVariables === true && variables !== null;

  function markAsUsed(id: string) {
    if (!entries.has(id)) {
      entries.add(id);
    }
  }

  function makeId(...names: string[]): string {
    return names.join('.');
  }

  const collectedInputTypes: Record<
    string,
    {
      all: boolean;
      fields: Set<string>;
    }
  > = {};

  function collectInputType(inputType: string, fieldName?: string) {
    if (!collectedInputTypes[inputType]) {
      collectedInputTypes[inputType] = {
        all: false,
        fields: new Set<string>(),
      };
    }

    if (fieldName) {
      collectedInputTypes[inputType].fields.add(fieldName);
    } else {
      collectedInputTypes[inputType].all = true;
    }
  }

  function collectNode(node: ObjectFieldNode | ArgumentNode) {
    const inputType = args.typeInfo.getInputType()!;
    const inputTypeName = resolveTypeName(inputType);

    if (node.value.kind === Kind.ENUM) {
      // Collect only a specific enum value
      collectInputType(inputTypeName, node.value.value);
    } else if (node.value.kind !== Kind.OBJECT && node.value.kind !== Kind.LIST) {
      // When processing of variables is enabled,
      // we want to skip collecting full input types of variables
      // and only collect specific fields.
      // That's why the following condition is added.
      // Otherwise we would mark entire input types as used, and not granular fields.
      if (node.value.kind === Kind.VARIABLE && shouldAnalyzeVariableValues) {
        return;
      }

      collectInputType(inputTypeName);
    }
  }

  function markEntireTypeAsUsed(type: GraphQLInputType): void {
    const namedType = getNamedType(type);

    if (collected_entire_named_types.has(namedType.name)) {
      // No need to mark this type as used again
      return;
    }
    // Add this type to the set of types that have been marked as used
    // to avoid infinite loops
    collected_entire_named_types.add(namedType.name);

    if (isScalarType(namedType)) {
      markAsUsed(makeId(namedType.name));
      return;
    }

    if (isEnumType(namedType)) {
      namedType.getValues().forEach(value => {
        markAsUsed(makeId(namedType.name, value.name));
      });
      return;
    }

    const fieldsMap = namedType.getFields();

    for (const fieldName in fieldsMap) {
      const field = fieldsMap[fieldName];

      markAsUsed(makeId(namedType.name, field.name));
      markEntireTypeAsUsed(field.type);
    }
  }

  function collectVariable(namedType: GraphQLNamedInputType, variableValue: unknown) {
    const variableValueArray = Array.isArray(variableValue) ? variableValue : [variableValue];
    if (isInputObjectType(namedType)) {
      variableValueArray.forEach(variable => {
        if (variable) {
          // Collect only the used fields
          for (const fieldName in variable) {
            const field = namedType.getFields()[fieldName];
            if (field) {
              collectInputType(namedType.name, fieldName);
              collectVariable(getNamedType(field.type), variable[fieldName]);
            }
          }
        } else {
          // Collect type without fields
          markAsUsed(makeId(namedType.name));
        }
      });
    } else {
      collectInputType(namedType.name);
    }
  }

  visit(
    args.documentNode,
    visitWithTypeInfo(args.typeInfo, {
      Field(node, _key, _parent, path, ancestors) {
        const parent = args.typeInfo.getParentType();
        const field = args.typeInfo.getFieldDef();

        if (!parent) {
          throw new Error(
            `Could not find a parent type of a field at ${printPath(path, ancestors, node.name)}`,
          );
        }

        if (!field) {
          throw new Error(
            `Could not find a field definition of a field at ${printPath(
              path,
              ancestors,
              node.name,
            )}`,
          );
        }

        markAsUsed(makeId(parent.name, field.name));

        // Collect the entire type if it's an enum.
        // Deleting an enum value that is used,
        // should be a breaking change
        // as it changes the output of the field.
        const fieldType = getNamedType(field.type);
        if (fieldType instanceof GraphQLEnumType) {
          markEntireTypeAsUsed(fieldType);
        }
      },
      VariableDefinition(node) {
        const inputType = args.typeInfo.getInputType();

        if (!inputType) {
          throw new Error(`Could not find an input type of a variable $${node.variable.name}`);
        }

        if (shouldAnalyzeVariableValues) {
          // Granular collection of variable values is enabled
          const variableName = node.variable.name.value;
          const variableValue = variables[variableName];
          const namedType = getNamedType(inputType);

          collectVariable(namedType, variableValue);
        } else {
          // Collect the entire type without processing the variables
          collectInputType(resolveTypeName(inputType));
        }
      },
      Directive(node) {
        return {
          ...node,
          arguments: [],
        };
      },
      Argument(node, _key, _parent, path, ancestors) {
        const parent = args.typeInfo.getParentType();
        const field = args.typeInfo.getFieldDef();
        const arg = args.typeInfo.getArgument();

        if (!parent) {
          throw new Error(
            `Could not find a parent type of an argument at ${printPath(
              path,
              ancestors,
              node.name,
            )}`,
          );
        }

        if (!field) {
          throw new Error(
            `Could not find a field definition of an argument at ${printPath(
              path,
              ancestors,
              node.name,
            )}`,
          );
        }

        if (!arg) {
          throw new Error(
            `Could not find an argument definition of an argument at ${printPath(
              path,
              ancestors,
              node.name,
            )}`,
          );
        }

        markAsUsed(makeId(parent.name, field.name, arg.name));
        collectNode(node);
      },
      ListValue(node, _key, _parent, path, ancestors) {
        const inputType = args.typeInfo.getInputType();

        if (!inputType) {
          throw new Error(
            `Could not find an input type of a list value at ${printPath(path, ancestors)}`,
          );
        }

        const inputTypeName = resolveTypeName(inputType);

        node.values.forEach(value => {
          if (value.kind === Kind.ENUM) {
            collectInputType(inputTypeName, value.value);
          } else if (value.kind !== Kind.OBJECT) {
            // if a value is not an object we need to collect all fields
            collectInputType(inputTypeName);
          }
        });
      },
      ObjectField(node, _key, _parent, path, ancestors) {
        const parentInputType = args.typeInfo.getParentInputType();

        if (!parentInputType) {
          throw new Error(
            `Could not find an input type of an object field at ${printPath(
              path,
              ancestors,
              node.name,
            )}`,
          );
        }

        const parentInputTypeName = resolveTypeName(parentInputType);

        collectNode(node);
        collectInputType(parentInputTypeName, node.name.value);
      },
    }),
  );

  for (const inputTypeName in collectedInputTypes) {
    const { fields, all } = collectedInputTypes[inputTypeName];

    if (all) {
      markEntireTypeAsUsed(args.schema.getType(inputTypeName) as any);
    } else {
      fields.forEach(field => {
        markAsUsed(makeId(inputTypeName, field));
      });
    }
  }

  return entries;
}

function resolveTypeName(inputType: GraphQLType): string {
  return getNamedType(inputType).name;
}

function printPath(
  path: readonly (string | number)[],
  ancestors: readonly (ASTNode | readonly ASTNode[])[],
  leafNameNode?: NameNode,
): string {
  const result: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const ancestor = ancestors[i];

    if (!ancestor) {
      break;
    }

    if (key === 'selectionSet') {
      if ('name' in ancestor && ancestor.name?.value) {
        result.push(ancestor.name.value);
      }
    }
  }

  if (leafNameNode) {
    result.push(leafNameNode.value);
  }

  return result.join('.');
}

type GraphQLNamedInputType = Exclude<
  GraphQLNamedType,
  GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType
>;
