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

const exists = {};

function cleanUnused(doc: DocumentNode, usedCoordinates: string[]): DocumentNode {
  // TODO: look for interfaces and unions members

  const typeFieldArgsUsed: {
    [type: string]: {
      [field: string]: {
        [arg: string]: typeof exists;
      };
    };
  } = {};

  for (const coordinate of usedCoordinates) {
    const [typeName, fieldName, argName] = coordinate.split('.');

    if (!typeFieldArgsUsed[typeName]) {
      typeFieldArgsUsed[typeName] = {};
    }

    if (!typeFieldArgsUsed[typeName][fieldName]) {
      typeFieldArgsUsed[typeName][fieldName] = {};
    }

    if (argName) {
      typeFieldArgsUsed[typeName][fieldName][argName] = exists;
    }
  }

  const typeNodeInfo = new TypeNodeInfo();
  return visit(
    doc,
    visitWithTypeNodeInfo(typeNodeInfo, {
      ScalarTypeDefinition(node) {
        if (!typeFieldArgsUsed[node.name.value]) {
          return null;
        }
      },
      ScalarTypeExtension(node) {
        if (!typeFieldArgsUsed[node.name.value]) {
          return null;
        }
      },
      ObjectTypeDefinition(node) {
        if (!typeFieldArgsUsed[node.name.value]) {
          return null;
        }

        if (node.interfaces?.length) {
          return {
            ...node,
            interfaces: node.interfaces.filter(iface => {
              if (!typeFieldArgsUsed[iface.name.value]) {
                return false;
              }

              return true;
            }),
          };
        }
      },
      ObjectTypeExtension(node) {
        if (!typeFieldArgsUsed[node.name.value]) {
          return null;
        }

        if (node.interfaces?.length) {
          return {
            ...node,
            interfaces: node.interfaces.filter(iface => {
              if (!typeFieldArgsUsed[iface.name.value]) {
                return false;
              }

              return true;
            }),
          };
        }
      },
      InterfaceTypeDefinition(node) {
        if (!typeFieldArgsUsed[node.name.value]) {
          return null;
        }

        if (node.interfaces?.length) {
          return {
            ...node,
            interfaces: node.interfaces.filter(iface => {
              if (!typeFieldArgsUsed[iface.name.value]) {
                return false;
              }

              return true;
            }),
          };
        }
      },
      InterfaceTypeExtension(node) {
        if (!typeFieldArgsUsed[node.name.value]) {
          return null;
        }

        if (node.interfaces?.length) {
          return {
            ...node,
            interfaces: node.interfaces.filter(iface => {
              if (!typeFieldArgsUsed[iface.name.value]) {
                return false;
              }

              return true;
            }),
          };
        }
      },
      InputObjectTypeDefinition(node) {
        if (!typeFieldArgsUsed[node.name.value]) {
          return null;
        }
      },
      InputObjectTypeExtension(node) {
        if (!typeFieldArgsUsed[node.name.value]) {
          return null;
        }
      },
      FieldDefinition(node) {
        const typeName = typeNodeInfo.getTypeDef()?.name.value;

        if (!typeName) {
          throw new Error('Expected type name');
        }

        if (!typeFieldArgsUsed[typeName]) {
          return null;
        }

        if (!typeFieldArgsUsed[typeName][node.name.value]) {
          return null;
        }
      },
      InputValueDefinition(node) {
        const typeName = typeNodeInfo.getTypeDef()?.name.value;
        const fieldDef = typeNodeInfo.getFieldDef();
        const fieldName = fieldDef?.name.value;

        if (!typeName || !fieldName) {
          throw new Error('Expected type and field name');
        }

        if (!typeFieldArgsUsed[typeName]) {
          return null;
        }

        if (!typeFieldArgsUsed[typeName][fieldName]) {
          return null;
        }

        // If it's not a field arg, we stop here
        if (fieldDef.kind !== Kind.FIELD_DEFINITION) {
          return;
        }

        if (!typeFieldArgsUsed[typeName][fieldName][node.name.value]) {
          return null;
        }
      },
    }),
  );
}

test('test', () => {
  const cleaned = cleanUnused(
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
    ['Query.user', 'Query.me', 'User.email', 'User.name', 'User.id', 'UserFilter.name'],
  );

  expect(print(cleaned)).toMatchInlineSnapshot(
    print(
      parse(/* GraphQL */ `
        type Query {
          me: User!
          user: User
        }

        type User {
          id: ID!
          name: String!
          email: String!
        }

        input UserFilter {
          name: String
        }
      `),
    ),
  );
});
