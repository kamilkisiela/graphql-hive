import {
  ASTNode,
  ASTVisitFn,
  ASTVisitor,
  DirectiveDefinitionNode,
  DocumentNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  parse,
  print,
  TypeDefinitionNode,
  TypeExtensionNode,
  visit,
} from 'graphql';

// Ported from GraphQL-JS
type Maybe<T> = T | null | undefined;
// Ported from GraphQL-JS
function getEnterLeaveForKind(
  visitor: ASTVisitor,
  kind: Kind,
): {
  enter?: ASTVisitFn<ASTNode>;
  leave?: ASTVisitFn<ASTNode>;
} {
  const kindVisitor = (visitor as any)[kind];

  if (typeof kindVisitor === 'object') {
    // { Kind: { enter() {}, leave() {} } }
    return kindVisitor;
  }

  if (typeof kindVisitor === 'function') {
    // { Kind() {} }
    return { enter: kindVisitor, leave: undefined };
  }

  // { enter() {}, leave() {} }
  return { enter: (visitor as any).enter, leave: (visitor as any).leave };
}

function isNode(maybeNode: any): maybeNode is ASTNode {
  const maybeKind = maybeNode?.kind;
  return typeof maybeKind === 'string';
}

export class TypeNodeInfo {
  private _type: Maybe<TypeDefinitionNode | TypeExtensionNode | DirectiveDefinitionNode>;
  private _field: Maybe<FieldDefinitionNode | InputValueDefinitionNode>;
  private _arg: Maybe<InputValueDefinitionNode>;
  private _value: Maybe<EnumValueDefinitionNode>;

  constructor() {
    this._type = undefined;
    this._field = undefined;
    this._arg = undefined;
    this._value = undefined;
  }

  get [Symbol.toStringTag]() {
    return 'TypeNodeInfo';
  }

  getTypeDef() {
    return this._type;
  }

  getFieldDef() {
    return this._field;
  }

  getArgumentDef() {
    return this._arg;
  }

  getValueDef() {
    return this._value;
  }

  enter(node: ASTNode) {
    switch (node.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION:
      case Kind.DIRECTIVE_DEFINITION:
        this._type = node;
        break;

      case Kind.ENUM_VALUE_DEFINITION:
        this._value = node;
        break;

      case Kind.FIELD_DEFINITION:
        this._field = node;
        break;

      case Kind.INPUT_VALUE_DEFINITION:
        if (this._field) {
          this._arg = node;
        } else {
          this._field = node;
        }
        break;
      default:

      // Ignore other nodes
    }
  }

  leave(node: ASTNode) {
    switch (node.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION:
      case Kind.DIRECTIVE_DEFINITION:
        this._type = undefined;
        break;

      case Kind.FIELD_DEFINITION:
        this._field = undefined;
        break;

      case Kind.ENUM_VALUE_DEFINITION:
        this._value = undefined;
        break;

      case Kind.INPUT_VALUE_DEFINITION:
        if (this._arg) {
          this._arg = undefined;
        } else {
          this._field = undefined;
        }
        break;

      default:
      // Ignore other nodes
    }
  }
}

/**
 * Creates a new visitor instance which maintains a provided TypeNodeInfo instance
 * along with visiting visitor.
 */
export function visitWithTypeNodeInfo(typeInfo: TypeNodeInfo, visitor: ASTVisitor): ASTVisitor {
  return {
    enter(
      node: ASTNode,
      key: string | number | undefined,
      parent: ASTNode | ReadonlyArray<ASTNode> | undefined,
      path: ReadonlyArray<string | number>,
      ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
    ) {
      typeInfo.enter(node);
      const fn = getEnterLeaveForKind(visitor, node.kind).enter;
      if (fn) {
        const result = fn.call(visitor, node, key, parent, path, ancestors);
        if (result !== undefined) {
          typeInfo.leave(node);
          if (isNode(result)) {
            typeInfo.enter(result);
          }
        }
        return result;
      }
    },
    leave(
      node: ASTNode,
      key: string | number | undefined,
      parent: ASTNode | ReadonlyArray<ASTNode> | undefined,
      path: ReadonlyArray<string | number>,
      ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
    ) {
      const fn = getEnterLeaveForKind(visitor, node.kind).leave;
      let result;
      if (fn) {
        result = fn.call(visitor, node, key, parent, path, ancestors);
      }
      typeInfo.leave(node);
      return result;
    },
  };
}

function stripUsedSchemaCoordinatesFromDocumentNode(
  doc: DocumentNode,
  usedCoordinates: Set<string>,
): DocumentNode {
  const typeNodeInfo = new TypeNodeInfo();
  return visit(
    doc,
    visitWithTypeNodeInfo(typeNodeInfo, {
      ScalarTypeDefinition(node) {
        if (usedCoordinates.has(node.name.value)) {
          return null;
        }
      },
      ScalarTypeExtension(node) {
        if (usedCoordinates.has(node.name.value)) {
          return null;
        }
      },
      FieldDefinition: {
        leave(node) {
          const typeName = typeNodeInfo.getTypeDef()?.name.value;
          const fieldName = node.name.value;

          if (!typeName) {
            throw new Error('Expected type name');
          }

          // if a field is used but some of it's arguments is not used, we cannot remove the field
          // we can simply check if some of the arguments are used, if not we can remove the field
          if (!node.arguments?.length && usedCoordinates.has(`${typeName}.${fieldName}`)) {
            return null;
          }
        },
      },
      InputValueDefinition: {
        leave(node) {
          const typeName = typeNodeInfo.getTypeDef()?.name.value;
          const fieldDef = typeNodeInfo.getFieldDef();
          const fieldName = fieldDef?.name.value;

          if (!typeName || !fieldName) {
            throw new Error('Expected type and field name');
          }

          const coordinate =
            fieldDef.kind === Kind.FIELD_DEFINITION
              ? `${typeName}.${fieldName}.${node.name.value}`
              : `${typeName}.${fieldName}`;

          if (usedCoordinates.has(coordinate)) {
            return null;
          }
        },
      },

      ObjectTypeDefinition: {
        leave(node) {
          if (!node.fields?.length) {
            return null;
          }
        },
      },
      ObjectTypeExtension: {
        leave(node) {
          if (!node.fields?.length) {
            return null;
          }
        },
      },
      InterfaceTypeDefinition: {
        leave(node) {
          if (!node.fields?.length) {
            return null;
          }
        },
      },
      InterfaceTypeExtension: {
        leave(node) {
          if (!node.fields?.length) {
            return null;
          }
        },
      },
      InputObjectTypeDefinition: {
        leave(node) {
          if (!node.fields?.length) {
            return null;
          }
        },
      },
      InputObjectTypeExtension: {
        leave(node) {
          if (!node.fields?.length) {
            return null;
          }
        },
      },
    }),
  );
}

test('test', () => {
  const cleaned = stripUsedSchemaCoordinatesFromDocumentNode(
    parse(/* GraphQL */ `
      type Query {
        me: User!
        users(filter: UserFilter): [User!]!
        user(id: ID!): User
      }

      type User implements Node {
        id: ID!
        name: String!
        email: String!
        posts: [Post!]!
      }

      type Post implements Node {
        id: ID!
        title: String!
        body: String!
      }

      input UserFilter {
        name: String
        email: String
      }

      interface Node {
        id: ID!
      }
    `),
    new Set(['Query.user', 'Query.me', 'User.email', 'User.name', 'User.id', 'UserFilter.name']),
  );

  expect(print(cleaned)).toMatchInlineSnapshot(
    print(
      parse(/* GraphQL */ `
        type Query {
          users(filter: UserFilter): [User!]!
          user(id: ID!): User
        }

        type User implements Node {
          posts: [Post!]!
        }

        type Post implements Node {
          id: ID!
          title: String!
          body: String!
        }

        input UserFilter {
          email: String
        }

        interface Node {
          id: ID!
        }
      `),
    ),
  );
});
