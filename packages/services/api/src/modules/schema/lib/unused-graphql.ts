import { DocumentNode, Kind, visit } from 'graphql';
import { TypeNodeInfo, visitWithTypeNodeInfo } from './ast-visitor';

export function stripUsedSchemaCoordinatesFromDocumentNode(
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

          const coordinate = `${typeName}.${fieldName}`;
          if (usedCoordinates.has(coordinate)) {
            return null;
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

      EnumTypeDefinition: {
        enter(node) {
          if (usedCoordinates.has(node.name.value)) {
            return null;
          }
        },
      },
      EnumTypeExtension: {
        enter(node) {
          if (usedCoordinates.has(node.name.value)) {
            return null;
          }
        },
      },

      UnionTypeDefinition: {
        enter(node) {
          if (usedCoordinates.has(node.name.value)) {
            return null;
          }
        },
      },
      UnionTypeExtension: {
        enter(node) {
          if (usedCoordinates.has(node.name.value)) {
            return null;
          }
        },
      },
    }),
  );
}
