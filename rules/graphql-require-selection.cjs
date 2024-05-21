/// @ts-check
const {
  requireGraphQLSchemaFromContext,
  requireSiblingsOperations,
} = require('@graphql-eslint/eslint-plugin');

const {
  Kind,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  isListType,
  isNonNullType,
} = require('graphql');

function getBaseType(type) {
  if (isNonNullType(type) || isListType(type)) {
    return getBaseType(type.ofType);
  }
  return type;
}

const RULE_ID = 'graphql-require-selections';
const idNames = ['temporaryFixId'];

/// Ported https://github.com/dimaMachina/graphql-eslint/blob/3c1020888472eb6579ffddc1e8e5ec16df8fad74/packages/plugin/src/rules/require-selections.ts

/**
 * @type {import('@graphql-eslint/eslint-plugin').GraphQLESLintRule}
 */
const rule = {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    messages: {
      [RULE_ID]:
        "Field{{ pluralSuffix }} {{ fieldName }} must be selected when it's available on a type.\nInclude it in your selection set{{ addition }}.",
    },
    docs: {
      category: 'Operations',
      description: 'Enforce selecting specific fields when they are available on the GraphQL type.',
      requiresSchema: true,
      requiresSiblings: true,
    },
    schema: [],
  },

  create(context) {
    const schema = requireGraphQLSchemaFromContext(RULE_ID, context);
    const siblings = requireSiblingsOperations(RULE_ID, context);

    // Check selections only in OperationDefinition,
    // skip selections of OperationDefinition and InlineFragment
    const selector =
      'OperationDefinition SelectionSet[parent.kind!=/(^OperationDefinition|InlineFragment)$/]';
    const typeInfo = new TypeInfo(schema);

    function checkFragments(node) {
      for (const selection of node.selections) {
        if (selection.kind !== Kind.FRAGMENT_SPREAD) {
          continue;
        }

        const [foundSpread] = siblings.getFragment(selection.name.value);
        if (!foundSpread) {
          continue;
        }

        const checkedFragmentSpreads = new Set();
        const visitor = visitWithTypeInfo(typeInfo, {
          SelectionSet(node, key, _parent) {
            const parent = _parent;
            if (parent.kind === Kind.FRAGMENT_DEFINITION) {
              checkedFragmentSpreads.add(parent.name.value);
            } else if (parent.kind !== Kind.INLINE_FRAGMENT) {
              checkSelections(
                node,
                typeInfo.getType(),
                selection.loc.start,
                parent,
                checkedFragmentSpreads,
              );
            }
          },
        });

        visit(foundSpread.document, visitor);
      }
    }

    function checkSelections(
      node,
      type,
      // Fragment can be placed in separate file
      // Provide actual fragment spread location instead of location in fragment
      loc,
      // Can't access to node.parent in GraphQL AST.Node, so pass as argument
      parent,
      checkedFragmentSpreads = new Set(),
    ) {
      const rawType = getBaseType(type);

      if (rawType instanceof GraphQLObjectType || rawType instanceof GraphQLInterfaceType) {
        checkFields(rawType);
      } else if (rawType instanceof GraphQLUnionType) {
        for (const selection of node.selections) {
          if (selection.kind === Kind.INLINE_FRAGMENT) {
            const types = rawType.getTypes();
            const t = types.find(t => t.name === selection.typeCondition.name.value);
            if (t) {
              checkFields(t);
            }
          }
        }
      }

      function checkFields(rawType) {
        const fields = rawType.getFields();
        const hasIdFieldInType = idNames.some(name => fields[name]);

        if (!hasIdFieldInType) {
          return;
        }

        function hasIdField({ selections }) {
          return selections.some(selection => {
            if (selection.kind === Kind.FIELD) {
              if (selection.alias && idNames.includes(selection.alias.value)) {
                return true;
              }

              return idNames.includes(selection.name.value);
            }

            if (selection.kind === Kind.INLINE_FRAGMENT) {
              return hasIdField(selection.selectionSet);
            }

            if (selection.kind === Kind.FRAGMENT_SPREAD) {
              const [foundSpread] = siblings.getFragment(selection.name.value);
              if (foundSpread) {
                const fragmentSpread = foundSpread.document;
                checkedFragmentSpreads.add(fragmentSpread.name.value);
                return hasIdField(fragmentSpread.selectionSet);
              }
            }
            return false;
          });
        }

        const hasId = hasIdField(node);

        checkFragments(node);

        if (hasId) {
          return;
        }

        const pluralSuffix = idNames.length > 1 ? 's' : '';
        const fieldName = idNames.join(',');

        const addition =
          checkedFragmentSpreads.size === 0
            ? ''
            : ` or add to used fragment${
                checkedFragmentSpreads.size > 1 ? 's' : ''
              } ${Array.from(checkedFragmentSpreads).join(', ')}`;

        const problem = {
          loc,
          messageId: RULE_ID,
          data: {
            pluralSuffix,
            fieldName,
            addition,
          },
        };

        // Don't provide suggestions for selections in fragments as fragment can be in a separate file
        if ('type' in node) {
          problem.suggest = idNames.map(idName => ({
            desc: `Add \`${idName}\` selection`,
            fix: fixer => {
              let insertNode = node.selections[0];
              insertNode =
                insertNode.kind === Kind.INLINE_FRAGMENT
                  ? insertNode.selectionSet.selections[0]
                  : insertNode;
              return fixer.insertTextBefore(insertNode, `${idName} `);
            },
          }));
        }
        context.report(problem);
      }
    }

    return {
      [selector](node) {
        const typeInfo = node.typeInfo();
        if (typeInfo.gqlType) {
          checkSelections(node, typeInfo.gqlType, node.loc.start, node.parent);
        }
      },
    };
  },
};

module.exports = rule;
