import { DocumentNode, Kind, visit } from 'graphql';
import { TypeNodeInfo, visitWithTypeNodeInfo } from './ast-visitor';

export function onlyDeprecatedDocumentNode(doc: DocumentNode): DocumentNode {
  const typeNodeInfo = new TypeNodeInfo();
  const preservedCoordinates = new Set<string>();

  // First pass to collect deprecated coordinates
  visit(
    doc,
    visitWithTypeNodeInfo(typeNodeInfo, {
      enter(node) {
        const isDeprecated =
          'directives' in node &&
          node.directives?.some(directive => directive.name.value === 'deprecated');

        if (!isDeprecated) {
          return;
        }

        const typeDef = typeNodeInfo.getTypeDef();

        if (!typeDef) {
          throw new Error('Expected type definition');
        }

        const fieldDef = typeNodeInfo.getFieldDef();
        const argDef = typeNodeInfo.getArgumentDef();
        const valueDef = typeNodeInfo.getValueDef();

        preservedCoordinates.add(typeDef.name.value);

        if (argDef) {
          if (!fieldDef) {
            throw new Error('Expected field definition');
          }

          // Preserve argument
          preservedCoordinates.add(
            `${typeDef.name.value}.${fieldDef.name.value}.${argDef.name.value}`,
          );
          // Preserve field
          preservedCoordinates.add(`${typeDef.name.value}.${fieldDef.name.value}`);
        }

        if (fieldDef) {
          // Preserve field
          preservedCoordinates.add(`${typeDef.name.value}.${fieldDef.name.value}`);
        }

        if (valueDef) {
          // Preserve enum value
          preservedCoordinates.add(`${typeDef.name.value}.${valueDef.name.value}`);
        }
      },
    }),
  );

  // Second pass to remove non-deprecated coordinates
  return visit(
    doc,
    visitWithTypeNodeInfo(typeNodeInfo, {
      enter(node) {
        if (node.kind === Kind.DOCUMENT) {
          return;
        }

        // No need to preserve these, as they can't be deprecated
        if (
          node.kind === Kind.SCALAR_TYPE_DEFINITION ||
          node.kind === Kind.SCALAR_TYPE_EXTENSION ||
          node.kind === Kind.UNION_TYPE_DEFINITION ||
          node.kind === Kind.UNION_TYPE_EXTENSION ||
          node.kind === Kind.SCHEMA_DEFINITION ||
          node.kind === Kind.SCHEMA_EXTENSION ||
          node.kind === Kind.DIRECTIVE_DEFINITION
        ) {
          return null;
        }

        if (
          node.kind === Kind.OBJECT_TYPE_DEFINITION ||
          node.kind === Kind.OBJECT_TYPE_EXTENSION ||
          node.kind === Kind.ENUM_TYPE_DEFINITION ||
          node.kind === Kind.ENUM_TYPE_EXTENSION ||
          node.kind === Kind.INTERFACE_TYPE_DEFINITION ||
          node.kind === Kind.INTERFACE_TYPE_EXTENSION ||
          node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
          node.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION
        ) {
          if (!preservedCoordinates.has(node.name.value)) {
            return null;
          }
        }

        if (node.kind === Kind.FIELD_DEFINITION) {
          const typeName = typeNodeInfo.getTypeDef()?.name.value;
          const fieldName = node.name.value;

          if (!typeName) {
            throw new Error('Expected type to be defined');
          }

          if (!preservedCoordinates.has(`${typeName}.${fieldName}`)) {
            return null;
          }
        }

        if (node.kind === Kind.INPUT_VALUE_DEFINITION) {
          const typeName = typeNodeInfo.getTypeDef()?.name.value;
          const fieldDef = typeNodeInfo.getFieldDef();

          if (!typeName) {
            throw new Error('Expected type to be defined');
          }

          const coordinate =
            fieldDef?.kind === Kind.FIELD_DEFINITION
              ? `${typeName}.${fieldDef.name.value}.${node.name.value}`
              : `${typeName}.${node.name.value}`;

          if (!preservedCoordinates.has(coordinate)) {
            return null;
          }
        }
      },
    }),
  );
}
