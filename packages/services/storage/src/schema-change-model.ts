/** These mirror DB models from  */
import { RegistryServiceUrlChangeSerializableChange } from 'packages/services/api/src/modules/schema/schema-change-from-meta';
import { z } from 'zod';
import type {
  ChangeType,
  DirectiveAddedChange,
  DirectiveArgumentAddedChange,
  DirectiveArgumentDefaultValueChangedChange,
  DirectiveArgumentDescriptionChangedChange,
  DirectiveArgumentRemovedChange,
  DirectiveArgumentTypeChangedChange,
  DirectiveDescriptionChangedChange,
  DirectiveLocationAddedChange,
  DirectiveLocationRemovedChange,
  DirectiveRemovedChange,
  EnumValueAddedChange,
  EnumValueDeprecationReasonAddedChange,
  EnumValueDeprecationReasonChangedChange,
  EnumValueDeprecationReasonRemovedChange,
  EnumValueDescriptionChangedChange,
  EnumValueRemovedChange,
  FieldAddedChange,
  FieldArgumentAddedChange,
  FieldArgumentDefaultChangedChange,
  FieldArgumentDescriptionChangedChange,
  FieldArgumentRemovedChange,
  FieldArgumentTypeChangedChange,
  FieldDeprecationAddedChange,
  FieldDeprecationReasonAddedChange,
  FieldDeprecationReasonChangedChange,
  FieldDeprecationReasonRemovedChange,
  FieldDeprecationRemovedChange,
  FieldDescriptionAddedChange,
  FieldDescriptionChangedChange,
  FieldDescriptionRemovedChange,
  FieldRemovedChange,
  FieldTypeChangedChange,
  InputFieldAddedChange,
  InputFieldDefaultValueChangedChange,
  InputFieldDescriptionAddedChange,
  InputFieldDescriptionChangedChange,
  InputFieldDescriptionRemovedChange,
  InputFieldRemovedChange,
  InputFieldTypeChangedChange,
  ObjectTypeInterfaceAddedChange,
  ObjectTypeInterfaceRemovedChange,
  SchemaMutationTypeChangedChange,
  SchemaQueryTypeChangedChange,
  SchemaSubscriptionTypeChangedChange,
  SerializableChange,
  TypeAddedChange,
  TypeDescriptionAddedChange,
  TypeDescriptionChangedChange,
  TypeDescriptionRemovedChange,
  TypeKindChangedChange,
  TypeRemovedChange,
  UnionMemberAddedChange,
  UnionMemberRemovedChange,
} from '@graphql-inspector/core';

// prettier-ignore
const FieldArgumentDescriptionChangedLiteral = z.literal("FIELD_ARGUMENT_DESCRIPTION_CHANGED" satisfies `${ChangeType.FieldArgumentDescriptionChanged}`)
// prettier-ignore
const FieldArgumentDefaultChangedLiteral =  z.literal("FIELD_ARGUMENT_DEFAULT_CHANGED" satisfies `${ChangeType.FieldArgumentDefaultChanged}`)
// prettier-ignore
const FieldArgumentTypeChangedLiteral =  z.literal("FIELD_ARGUMENT_TYPE_CHANGED" satisfies `${ChangeType.FieldArgumentTypeChanged}`)
// prettier-ignore
const DirectiveRemovedLiteral =  z.literal("DIRECTIVE_REMOVED" satisfies `${ChangeType.DirectiveRemoved}`)
// prettier-ignore
const DirectiveAddedLiteral =  z.literal("DIRECTIVE_ADDED" satisfies `${ChangeType.DirectiveAdded}`)
// prettier-ignore
const DirectiveDescriptionChangedLiteral =  z.literal("DIRECTIVE_DESCRIPTION_CHANGED" satisfies `${ChangeType.DirectiveDescriptionChanged}`)
// prettier-ignore
const DirectiveLocationAddedLiteral =  z.literal("DIRECTIVE_LOCATION_ADDED" satisfies `${ChangeType.DirectiveLocationAdded}`)
// prettier-ignore
const DirectiveLocationRemovedLiteral =  z.literal("DIRECTIVE_LOCATION_REMOVED" satisfies `${ChangeType.DirectiveLocationRemoved}`)
// prettier-ignore
const DirectiveArgumentAddedLiteral =  z.literal("DIRECTIVE_ARGUMENT_ADDED" satisfies `${ChangeType.DirectiveArgumentAdded}`)
// prettier-ignore
const DirectiveArgumentRemovedLiteral =  z.literal("DIRECTIVE_ARGUMENT_REMOVED" satisfies `${ChangeType.DirectiveArgumentRemoved}`)
// prettier-ignore
const DirectiveArgumentDescriptionChangedLiteral =  z.literal("DIRECTIVE_ARGUMENT_DESCRIPTION_CHANGED" satisfies `${ChangeType.DirectiveArgumentDescriptionChanged}`)
// prettier-ignore
const DirectiveArgumentDefaultValueChangedLiteral =  z.literal("DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED" satisfies `${ChangeType.DirectiveArgumentDefaultValueChanged}`)
// prettier-ignore
const DirectiveArgumentTypeChangedLiteral =  z.literal("DIRECTIVE_ARGUMENT_TYPE_CHANGED" satisfies `${ChangeType.DirectiveArgumentTypeChanged}`)
// prettier-ignore
const EnumValueRemovedLiteral =  z.literal("ENUM_VALUE_REMOVED" satisfies `${ChangeType.EnumValueRemoved}`)
// prettier-ignore
const EnumValueAddedLiteral =  z.literal("ENUM_VALUE_ADDED" satisfies `${ChangeType.EnumValueAdded}`)
// prettier-ignore
const EnumValueDescriptionChangedLiteral =  z.literal("ENUM_VALUE_DESCRIPTION_CHANGED" satisfies `${ChangeType.EnumValueDescriptionChanged}`)
// prettier-ignore
const EnumValueDeprecationReasonChangedLiteral =  z.literal("ENUM_VALUE_DEPRECATION_REASON_CHANGED" satisfies `${ChangeType.EnumValueDeprecationReasonChanged}`)
// prettier-ignore
const EnumValueDeprecationReasonAddedLiteral =  z.literal("ENUM_VALUE_DEPRECATION_REASON_ADDED" satisfies `${ChangeType.EnumValueDeprecationReasonAdded}`)
// prettier-ignore
const EnumValueDeprecationReasonRemovedLiteral =  z.literal("ENUM_VALUE_DEPRECATION_REASON_REMOVED" satisfies `${ChangeType.EnumValueDeprecationReasonRemoved}`)
// prettier-ignore
const FieldRemovedLiteral =  z.literal("FIELD_REMOVED" satisfies `${ChangeType.FieldRemoved}`)
// prettier-ignore
const FieldAddedLiteral =  z.literal("FIELD_ADDED" satisfies `${ChangeType.FieldAdded}`)
// prettier-ignore
const FieldDescriptionChangedLiteral =  z.literal("FIELD_DESCRIPTION_CHANGED" satisfies `${ChangeType.FieldDescriptionChanged}`)
// prettier-ignore
const FieldDescriptionAddedLiteral =  z.literal("FIELD_DESCRIPTION_ADDED" satisfies `${ChangeType.FieldDescriptionAdded}`)
// prettier-ignore
const FieldDescriptionRemovedLiteral =  z.literal("FIELD_DESCRIPTION_REMOVED" satisfies `${ChangeType.FieldDescriptionRemoved}`)
// prettier-ignore
const FieldDeprecationAddedLiteral =  z.literal("FIELD_DEPRECATION_ADDED" satisfies `${ChangeType.FieldDeprecationAdded}`)
// prettier-ignore
const FieldDeprecationRemovedLiteral =  z.literal("FIELD_DEPRECATION_REMOVED" satisfies `${ChangeType.FieldDeprecationRemoved}`)
// prettier-ignore
const FieldDeprecationReasonChangedLiteral =  z.literal("FIELD_DEPRECATION_REASON_CHANGED" satisfies `${ChangeType.FieldDeprecationReasonChanged}`)
// prettier-ignore
const FieldDeprecationReasonAddedLiteral =  z.literal("FIELD_DEPRECATION_REASON_ADDED" satisfies `${ChangeType.FieldDeprecationReasonAdded}`)
// prettier-ignore
const FieldDeprecationReasonRemovedLiteral =  z.literal("FIELD_DEPRECATION_REASON_REMOVED" satisfies `${ChangeType.FieldDeprecationReasonRemoved}`)
// prettier-ignore
const FieldTypeChangedLiteral =  z.literal("FIELD_TYPE_CHANGED" satisfies `${ChangeType.FieldTypeChanged}`)
// prettier-ignore
const FieldArgumentAddedLiteral =  z.literal("FIELD_ARGUMENT_ADDED" satisfies `${ChangeType.FieldArgumentAdded}`)
// prettier-ignore
const FieldArgumentRemovedLiteral =  z.literal("FIELD_ARGUMENT_REMOVED" satisfies `${ChangeType.FieldArgumentRemoved}`)
// prettier-ignore
const InputFieldRemovedLiteral =  z.literal("INPUT_FIELD_REMOVED" satisfies `${ChangeType.InputFieldRemoved}`)
// prettier-ignore
const InputFieldAddedLiteral =  z.literal("INPUT_FIELD_ADDED" satisfies `${ChangeType.InputFieldAdded}`)
// prettier-ignore
const InputFieldDescriptionAddedLiteral =  z.literal("INPUT_FIELD_DESCRIPTION_ADDED" satisfies `${ChangeType.InputFieldDescriptionAdded}`)
// prettier-ignore
const InputFieldDescriptionRemovedLiteral =  z.literal("INPUT_FIELD_DESCRIPTION_REMOVED" satisfies `${ChangeType.InputFieldDescriptionRemoved}`)
// prettier-ignore
const InputFieldDescriptionChangedLiteral =  z.literal("INPUT_FIELD_DESCRIPTION_CHANGED" satisfies `${ChangeType.InputFieldDescriptionChanged}`)
// prettier-ignore
const InputFieldDefaultValueChangedLiteral =  z.literal("INPUT_FIELD_DEFAULT_VALUE_CHANGED" satisfies `${ChangeType.InputFieldDefaultValueChanged}`)
// prettier-ignore
const InputFieldTypeChangedLiteral =  z.literal("INPUT_FIELD_TYPE_CHANGED" satisfies `${ChangeType.InputFieldTypeChanged}`)
// prettier-ignore
const ObjectTypeInterfaceAddedLiteral =  z.literal("OBJECT_TYPE_INTERFACE_ADDED" satisfies `${ChangeType.ObjectTypeInterfaceAdded}`)
// prettier-ignore
const ObjectTypeInterfaceRemovedLiteral =  z.literal("OBJECT_TYPE_INTERFACE_REMOVED" satisfies `${ChangeType.ObjectTypeInterfaceRemoved}`)
// prettier-ignore
const SchemaQueryTypeChangedLiteral =  z.literal("SCHEMA_QUERY_TYPE_CHANGED" satisfies `${ChangeType.SchemaQueryTypeChanged}`)
// prettier-ignore
const SchemaMutationTypeChangedLiteral =  z.literal("SCHEMA_MUTATION_TYPE_CHANGED" satisfies `${ChangeType.SchemaMutationTypeChanged}`)
// prettier-ignore
const SchemaSubscriptionTypeChangedLiteral =  z.literal("SCHEMA_SUBSCRIPTION_TYPE_CHANGED" satisfies `${ChangeType.SchemaSubscriptionTypeChanged}`)
// prettier-ignore
const TypeRemovedLiteral =  z.literal("TYPE_REMOVED" satisfies `${ChangeType.TypeRemoved}`)
// prettier-ignore
const TypeAddedLiteral =  z.literal("TYPE_ADDED" satisfies `${ChangeType.TypeAdded}`)
// prettier-ignore
const TypeKindChangedLiteral =  z.literal("TYPE_KIND_CHANGED" satisfies `${ChangeType.TypeKindChanged}`)
// prettier-ignore
const TypeDescriptionChangedLiteral =  z.literal("TYPE_DESCRIPTION_CHANGED" satisfies `${ChangeType.TypeDescriptionChanged}`)
// prettier-ignore
const TypeDescriptionRemovedLiteral =  z.literal("TYPE_DESCRIPTION_REMOVED" satisfies `${ChangeType.TypeDescriptionRemoved}`)
// prettier-ignore
const TypeDescriptionAddedLiteral =  z.literal("TYPE_DESCRIPTION_ADDED" satisfies `${ChangeType.TypeDescriptionAdded}`)
// prettier-ignore
const UnionMemberRemovedLiteral =  z.literal("UNION_MEMBER_REMOVED" satisfies `${ChangeType.UnionMemberRemoved}`)
// prettier-ignore
const UnionMemberAddedLiteral =  z.literal("UNION_MEMBER_ADDED" satisfies `${ChangeType.UnionMemberAdded}`)

/**
 * @source https://github.com/colinhacks/zod/issues/372#issuecomment-1280054492
 */
type Implements<Model> = {
  [key in keyof Model]-?: undefined extends Model[key]
    ? null extends Model[key]
      ? z.ZodNullableType<z.ZodOptionalType<z.ZodType<Model[key]>>>
      : z.ZodOptionalType<z.ZodType<Model[key]>>
    : null extends Model[key]
    ? z.ZodNullableType<z.ZodType<Model[key]>>
    : Model[key] extends ChangeType
    ? z.ZodLiteral<`${Model[key]}`>
    : z.ZodType<Model[key]>;
};

export function implement<Model = never>() {
  return {
    with: <
      Schema extends Implements<Model> & {
        [unknownKey in Exclude<keyof Schema, keyof Model>]: never;
      },
    >(
      schema: Schema,
    ) => z.object(schema),
  };
}

export const FieldArgumentDescriptionChangedModel =
  implement<FieldArgumentDescriptionChangedChange>().with({
    type: FieldArgumentDescriptionChangedLiteral,
    meta: z.object({
      typeName: z.string(),
      fieldName: z.string(),
      argumentName: z.string(),
      oldDescription: z.union([z.string(), z.null()]),
      newDescription: z.union([z.string(), z.null()]),
    }),
  });

export const FieldArgumentDefaultChangedModel = implement<FieldArgumentDefaultChangedChange>().with(
  {
    type: FieldArgumentDefaultChangedLiteral,
    meta: z.object({
      typeName: z.string(),
      fieldName: z.string(),
      argumentName: z.string(),
      oldDefaultValue: z.optional(z.string()),
      newDefaultValue: z.optional(z.string()),
    }),
  },
);

export const FieldArgumentTypeChangedModel = implement<FieldArgumentTypeChangedChange>().with({
  type: FieldArgumentTypeChangedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
    argumentName: z.string(),
    oldArgumentType: z.string(),
    newArgumentType: z.string(),
    isSafeArgumentTypeChange: z.boolean(),
  }),
});

export const DirectiveRemovedModel = implement<DirectiveRemovedChange>().with({
  type: DirectiveRemovedLiteral,
  meta: z.object({
    removedDirectiveName: z.string(),
  }),
});

export const DirectiveAddedModel = implement<DirectiveAddedChange>().with({
  type: DirectiveAddedLiteral,
  meta: z.object({
    addedDirectiveName: z.string(),
  }),
});

export const DirectiveDescriptionChangedModel = implement<DirectiveDescriptionChangedChange>().with(
  {
    type: DirectiveDescriptionChangedLiteral,
    meta: z.object({
      directiveName: z.string(),
      oldDirectiveDescription: z.union([z.string(), z.null()]),
      newDirectiveDescription: z.union([z.string(), z.null()]),
    }),
  },
);

export const DirectiveLocationAddedModel = implement<DirectiveLocationAddedChange>().with({
  type: DirectiveLocationAddedLiteral,
  meta: z.object({
    directiveName: z.string(),
    addedDirectiveLocation: z.string(),
  }),
});

export const DirectiveLocationRemovedModel = implement<DirectiveLocationRemovedChange>().with({
  type: DirectiveLocationRemovedLiteral,
  meta: z.object({
    directiveName: z.string(),
    removedDirectiveLocation: z.string(),
  }),
});

export const DirectiveArgumentAddedModel = implement<DirectiveArgumentAddedChange>().with({
  type: DirectiveArgumentAddedLiteral,
  meta: z.object({
    directiveName: z.string(),
    addedDirectiveArgumentName: z.string(),
    addedDirectiveArgumentTypeIsNonNull: z.boolean(),
  }),
});

export const DirectiveArgumentRemovedModel = implement<DirectiveArgumentRemovedChange>().with({
  type: DirectiveArgumentRemovedLiteral,
  meta: z.object({
    directiveName: z.string(),
    removedDirectiveArgumentName: z.string(),
  }),
});

export const DirectiveArgumentDescriptionChangedModel =
  implement<DirectiveArgumentDescriptionChangedChange>().with({
    type: DirectiveArgumentDescriptionChangedLiteral,
    meta: z.object({
      directiveName: z.string(),
      directiveArgumentName: z.string(),
      oldDirectiveArgumentDescription: z.union([z.string(), z.null()]),
      newDirectiveArgumentDescription: z.union([z.string(), z.null()]),
    }),
  });

export const DirectiveArgumentDefaultValueChangedModel =
  implement<DirectiveArgumentDefaultValueChangedChange>().with({
    type: DirectiveArgumentDefaultValueChangedLiteral,
    meta: z.object({
      directiveName: z.string(),
      directiveArgumentName: z.string(),
      oldDirectiveArgumentDefaultValue: z.optional(z.string()),
      newDirectiveArgumentDefaultValue: z.optional(z.string()),
    }),
  });

export const DirectiveArgumentTypeChangedModel =
  implement<DirectiveArgumentTypeChangedChange>().with({
    type: DirectiveArgumentTypeChangedLiteral,
    meta: z.object({
      directiveName: z.string(),
      directiveArgumentName: z.string(),
      oldDirectiveArgumentType: z.string(),
      newDirectiveArgumentType: z.string(),
      isSafeDirectiveArgumentTypeChange: z.boolean(),
    }),
  });

// Enum

export const EnumValueRemovedModel = implement<EnumValueRemovedChange>().with({
  type: EnumValueRemovedLiteral,
  meta: z.object({
    enumName: z.string(),
    removedEnumValueName: z.string(),
    isEnumValueDeprecated: z.boolean(),
  }),
});

export const EnumValueAdded = implement<EnumValueAddedChange>().with({
  type: EnumValueAddedLiteral,
  meta: z.object({
    enumName: z.string(),
    addedEnumValueName: z.string(),
  }),
});

export const EnumValueDescriptionChangedModel = implement<EnumValueDescriptionChangedChange>().with(
  {
    type: EnumValueDescriptionChangedLiteral,
    meta: z.object({
      enumName: z.string(),
      enumValueName: z.string(),
      oldEnumValueDescription: z.union([z.string(), z.null()]),
      newEnumValueDescription: z.union([z.string(), z.null()]),
    }),
  },
);

export const EnumValueDeprecationReasonChangedModel =
  implement<EnumValueDeprecationReasonChangedChange>().with({
    type: EnumValueDeprecationReasonChangedLiteral,
    meta: z.object({
      enumName: z.string(),
      enumValueName: z.string(),
      oldEnumValueDeprecationReason: z.string(),
      newEnumValueDeprecationReason: z.string(),
    }),
  });

export const EnumValueDeprecationReasonAddedModel =
  implement<EnumValueDeprecationReasonAddedChange>().with({
    type: EnumValueDeprecationReasonAddedLiteral,
    meta: z.object({
      enumName: z.string(),
      enumValueName: z.string(),
      addedValueDeprecationReason: z.string(),
    }),
  });

export const EnumValueDeprecationReasonRemovedModel =
  implement<EnumValueDeprecationReasonRemovedChange>().with({
    type: EnumValueDeprecationReasonRemovedLiteral,
    meta: z.object({
      enumName: z.string(),
      enumValueName: z.string(),
      removedEnumValueDeprecationReason: z.string(),
    }),
  });

// Field

export const FieldRemovedModel = implement<FieldRemovedChange>().with({
  type: FieldRemovedLiteral,
  meta: z.object({
    typeName: z.string(),
    removedFieldName: z.string(),
    isRemovedFieldDeprecated: z.boolean(),
    typeType: z.string(),
  }),
});

export const FieldAddedModel = implement<FieldAddedChange>().with({
  type: FieldAddedLiteral,
  meta: z.object({
    typeName: z.string(),
    addedFieldName: z.string(),
    typeType: z.string(),
  }),
});

export const FieldDescriptionChangedModel = implement<FieldDescriptionChangedChange>().with({
  type: FieldDescriptionChangedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
    oldDescription: z.string(),
    newDescription: z.string(),
  }),
});

export const FieldDescriptionAddedModel = implement<FieldDescriptionAddedChange>().with({
  type: FieldDescriptionAddedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
    addedDescription: z.string(),
  }),
});

export const FieldDescriptionRemovedModel = implement<FieldDescriptionRemovedChange>().with({
  type: FieldDescriptionRemovedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
  }),
});

export const FieldDeprecationAddedModel = implement<FieldDeprecationAddedChange>().with({
  type: FieldDeprecationAddedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
  }),
});

export const FieldDeprecationRemovedModel = implement<FieldDeprecationRemovedChange>().with({
  type: FieldDeprecationRemovedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
  }),
});

export const FieldDeprecationReasonChangedModel =
  implement<FieldDeprecationReasonChangedChange>().with({
    type: FieldDeprecationReasonChangedLiteral,
    meta: z.object({
      typeName: z.string(),
      fieldName: z.string(),
      oldDeprecationReason: z.string(),
      newDeprecationReason: z.string(),
    }),
  });

export const FieldDeprecationReasonAddedModel = implement<FieldDeprecationReasonAddedChange>().with(
  {
    type: FieldDeprecationReasonAddedLiteral,
    meta: z.object({
      typeName: z.string(),
      fieldName: z.string(),
      addedDeprecationReason: z.string(),
    }),
  },
);

export const FieldDeprecationReasonRemovedModel =
  implement<FieldDeprecationReasonRemovedChange>().with({
    type: FieldDeprecationReasonRemovedLiteral,
    meta: z.object({
      typeName: z.string(),
      fieldName: z.string(),
    }),
  });

export const FieldTypeChangedModel = implement<FieldTypeChangedChange>().with({
  type: FieldTypeChangedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
    oldFieldType: z.string(),
    newFieldType: z.string(),
    isSafeFieldTypeChange: z.boolean(),
  }),
});

export const FieldArgumentAddedModel = implement<FieldArgumentAddedChange>().with({
  type: FieldArgumentAddedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
    addedArgumentName: z.string(),
    addedArgumentType: z.string(),
    hasDefaultValue: z.boolean(),
    isAddedFieldArgumentBreaking: z.boolean(),
  }),
});

export const FieldArgumentRemovedModel = implement<FieldArgumentRemovedChange>().with({
  type: FieldArgumentRemovedLiteral,
  meta: z.object({
    typeName: z.string(),
    fieldName: z.string(),
    removedFieldArgumentName: z.string(),
    removedFieldType: z.string(),
  }),
});

// Input

export const InputFieldRemovedModel = implement<InputFieldRemovedChange>().with({
  type: InputFieldRemovedLiteral,
  meta: z.object({
    inputName: z.string(),
    removedFieldName: z.string(),
    isInputFieldDeprecated: z.boolean(),
  }),
});

export const InputFieldAddedModel = implement<InputFieldAddedChange>().with({
  type: InputFieldAddedLiteral,
  meta: z.object({
    inputName: z.string(),
    addedInputFieldName: z.string(),
    isAddedInputFieldTypeNullable: z.boolean(),
    addedInputFieldType: z.string(),
  }),
});

export const InputFieldDescriptionAddedModel = implement<InputFieldDescriptionAddedChange>().with({
  type: InputFieldDescriptionAddedLiteral,
  meta: z.object({
    inputName: z.string(),
    inputFieldName: z.string(),
    addedInputFieldDescription: z.string(),
  }),
});

export const InputFieldDescriptionRemovedModel =
  implement<InputFieldDescriptionRemovedChange>().with({
    type: InputFieldDescriptionRemovedLiteral,
    meta: z.object({
      inputName: z.string(),
      inputFieldName: z.string(),
      removedDescription: z.string(),
    }),
  });

export const InputFieldDescriptionChangedModel =
  implement<InputFieldDescriptionChangedChange>().with({
    type: InputFieldDescriptionChangedLiteral,
    meta: z.object({
      inputName: z.string(),
      inputFieldName: z.string(),
      oldInputFieldDescription: z.string(),
      newInputFieldDescription: z.string(),
    }),
  });

export const InputFieldDefaultValueChangedModel =
  implement<InputFieldDefaultValueChangedChange>().with({
    type: InputFieldDefaultValueChangedLiteral,
    meta: z.object({
      inputName: z.string(),
      inputFieldName: z.string(),
      oldDefaultValue: z.optional(z.string()),
      newDefaultValue: z.optional(z.string()),
    }),
  });

export const InputFieldTypeChangedModel = implement<InputFieldTypeChangedChange>().with({
  type: InputFieldTypeChangedLiteral,
  meta: z.object({
    inputName: z.string(),
    inputFieldName: z.string(),
    oldInputFieldType: z.string(),
    newInputFieldType: z.string(),
    isInputFieldTypeChangeSafe: z.boolean(),
  }),
});

// Type

export const ObjectTypeInterfaceAddedModel = implement<ObjectTypeInterfaceAddedChange>().with({
  type: ObjectTypeInterfaceAddedLiteral,
  meta: z.object({
    objectTypeName: z.string(),
    addedInterfaceName: z.string(),
  }),
});

export const ObjectTypeInterfaceRemovedModel = implement<ObjectTypeInterfaceRemovedChange>().with({
  type: ObjectTypeInterfaceRemovedLiteral,
  meta: z.object({
    objectTypeName: z.string(),
    removedInterfaceName: z.string(),
  }),
});

// Schema

export const SchemaQueryTypeChangedModel = implement<SchemaQueryTypeChangedChange>().with({
  type: SchemaQueryTypeChangedLiteral,
  meta: z.object({
    oldQueryTypeName: z.string(),
    newQueryTypeName: z.string(),
  }),
});

export const SchemaMutationTypeChangedModel = implement<SchemaMutationTypeChangedChange>().with({
  type: SchemaMutationTypeChangedLiteral,
  meta: z.object({
    oldMutationTypeName: z.string(),
    newMutationTypeName: z.string(),
  }),
});

export const SchemaSubscriptionTypeChangedModel =
  implement<SchemaSubscriptionTypeChangedChange>().with({
    type: SchemaSubscriptionTypeChangedLiteral,
    meta: z.object({
      oldSubscriptionTypeName: z.string(),
      newSubscriptionTypeName: z.string(),
    }),
  });

// Type
export const TypeRemovedModel = implement<TypeRemovedChange>().with({
  type: TypeRemovedLiteral,
  meta: z.object({
    removedTypeName: z.string(),
  }),
});

export const TypeAddedModel = implement<TypeAddedChange>().with({
  type: TypeAddedLiteral,
  meta: z.object({
    addedTypeName: z.string(),
  }),
});

export const TypeKindChangedModel = implement<TypeKindChangedChange>().with({
  type: TypeKindChangedLiteral,
  meta: z.object({
    typeName: z.string(),
    oldTypeKind: z.string(),
    newTypeKind: z.string(),
  }),
});

export const TypeDescriptionChangedModel = implement<TypeDescriptionChangedChange>().with({
  type: TypeDescriptionChangedLiteral,
  meta: z.object({
    typeName: z.string(),
    oldTypeDescription: z.string(),
    newTypeDescription: z.string(),
  }),
});

export const TypeDescriptionAddedModel = implement<TypeDescriptionAddedChange>().with({
  type: TypeDescriptionAddedLiteral,
  meta: z.object({
    typeName: z.string(),
    addedTypeDescription: z.string(),
  }),
});

export const TypeDescriptionRemovedModel = implement<TypeDescriptionRemovedChange>().with({
  type: TypeDescriptionRemovedLiteral,
  meta: z.object({
    typeName: z.string(),
    removedTypeDescription: z.string(),
  }),
});

// Union
export const UnionMemberRemovedModel = implement<UnionMemberRemovedChange>().with({
  type: UnionMemberRemovedLiteral,
  meta: z.object({
    unionName: z.string(),
    removedUnionMemberTypeName: z.string(),
  }),
});

export const UnionMemberAddedModel = implement<UnionMemberAddedChange>().with({
  type: UnionMemberAddedLiteral,
  meta: z.object({
    unionName: z.string(),
    addedUnionMemberTypeName: z.string(),
  }),
});

// Service Registry Url Change

export const RegistryServiceUrlChangeModel =
  implement<RegistryServiceUrlChangeSerializableChange>().with({
    type: z.literal('REGISTRY_SERVICE_URL_CHANGED'),
    meta: z.object({
      serviceName: z.string(),
      serviceUrls: z.union([
        z.object({
          old: z.null(),
          new: z.string(),
        }),
        z.object({
          old: z.string(),
          new: z.null(),
        }),
        z.object({
          old: z.string(),
          new: z.string(),
        }),
      ]),
    }),
  });

// TODO: figure out a way to make sure that all the changes are included in the union
// Similar to implement().with() but for unions
export const SchemaChangeModel = z.union([
  FieldArgumentDescriptionChangedModel,
  FieldArgumentDefaultChangedModel,
  FieldArgumentTypeChangedModel,
  DirectiveRemovedModel,
  DirectiveAddedModel,
  DirectiveDescriptionChangedModel,
  DirectiveLocationAddedModel,
  DirectiveLocationRemovedModel,
  DirectiveArgumentAddedModel,
  DirectiveArgumentRemovedModel,
  DirectiveArgumentDescriptionChangedModel,
  DirectiveArgumentDefaultValueChangedModel,
  DirectiveArgumentTypeChangedModel,
  EnumValueRemovedModel,
  EnumValueAdded,
  EnumValueDescriptionChangedModel,
  EnumValueDeprecationReasonChangedModel,
  EnumValueDeprecationReasonAddedModel,
  EnumValueDeprecationReasonRemovedModel,
  FieldRemovedModel,
  FieldAddedModel,
  FieldDescriptionChangedModel,
  FieldDescriptionAddedModel,
  FieldDescriptionRemovedModel,
  FieldDeprecationAddedModel,
  FieldDeprecationRemovedModel,
  FieldDeprecationReasonChangedModel,
  FieldDeprecationReasonAddedModel,
  FieldDeprecationReasonRemovedModel,
  FieldTypeChangedModel,
  FieldArgumentAddedModel,
  FieldArgumentRemovedModel,
  InputFieldRemovedModel,
  InputFieldAddedModel,
  InputFieldDescriptionAddedModel,
  InputFieldDescriptionRemovedModel,
  InputFieldDescriptionChangedModel,
  InputFieldDefaultValueChangedModel,
  InputFieldTypeChangedModel,
  ObjectTypeInterfaceAddedModel,
  ObjectTypeInterfaceRemovedModel,
  SchemaQueryTypeChangedModel,
  SchemaMutationTypeChangedModel,
  SchemaSubscriptionTypeChangedModel,
  TypeRemovedModel,
  TypeAddedModel,
  TypeKindChangedModel,
  TypeDescriptionChangedModel,
  TypeDescriptionAddedModel,
  TypeDescriptionRemovedModel,
  UnionMemberRemovedModel,
  UnionMemberAddedModel,
  // Hive Federation/Stitching Specific
  RegistryServiceUrlChangeModel,
]);

({}) as SerializableChange satisfies z.TypeOf<typeof SchemaChangeModel>;

export type Change = z.infer<typeof SchemaChangeModel>;

export const SchemaCompositionErrorModel = z.object({
  message: z.string(),
  source: z.union([z.literal('graphql'), z.literal('composition')]),
});

export type SchemaCompositionError = z.TypeOf<typeof SchemaCompositionErrorModel>;

export const SchemaPolicyWarningModel = z.object({
  message: z.string(),
  line: z.number(),
  column: z.number(),
  ruleId: z.string(),
  endLine: z.number().nullable(),
  endColumn: z.number().nullable(),
});

const SchemaChangeModelWithIsSafeBreakingChange = z.intersection(
  SchemaChangeModel,
  z.object({ isSafeBasedOnUsage: z.boolean().optional() }),
);

const FailedSchemaCheckPartialModel = z.intersection(
  z.object({
    isSuccess: z.literal(false),

    breakingSchemaChanges: z.array(SchemaChangeModelWithIsSafeBreakingChange).nullable(),
    safeSchemaChanges: z.array(SchemaChangeModelWithIsSafeBreakingChange).nullable(),

    schemaPolicyWarnings: z.array(SchemaPolicyWarningModel).nullable(),
    schemaPolicyErrors: z.array(SchemaPolicyWarningModel).nullable(),

    isManuallyApproved: z.literal(false),
    manualApprovalUserId: z.null(),
  }),
  z.union([
    z.object({
      schemaCompositionErrors: z.array(SchemaCompositionErrorModel),

      compositeSchemaSDL: z.null(),
      supergraphSDL: z.null(),
    }),
    z.object({
      schemaCompositionErrors: z.null(),

      compositeSchemaSDL: z.string(),
      supergraphSDL: z.string().nullable(),
    }),
  ]),
);

const SuccessfulSchemaCheckPartialModel = z.intersection(
  z.object({
    isSuccess: z.literal(true),
    schemaCompositionErrors: z.null(),

    safeSchemaChanges: z.array(SchemaChangeModelWithIsSafeBreakingChange).nullable(),
    breakingSchemaChanges: z.array(SchemaChangeModelWithIsSafeBreakingChange).nullable(),
    schemaPolicyWarnings: z.array(SchemaPolicyWarningModel).nullable(),
    schemaPolicyErrors: z.array(SchemaPolicyWarningModel).nullable(),

    compositeSchemaSDL: z.string(),
    supergraphSDL: z.string().nullable(),
  }),
  z.union([
    z.object({
      isManuallyApproved: z.literal(true),
      manualApprovalUserId: z.string().nullable(),
    }),
    z.object({
      isManuallyApproved: z.literal(false),
      manualApprovalUserId: z.null(),
    }),
  ]),
);

const SchemaCheckSharedFieldsModel = z.object({
  schemaSDL: z.string(),
  serviceName: z.string().nullable(),
  targetId: z.string(),
  schemaVersionId: z.string().nullable(),
  meta: z
    .object({
      author: z.string(),
      commit: z.string(),
    })
    .nullable(),
  githubCheckRunId: z.number().nullable(),
});

const SchemaCheckInputModel = z.intersection(
  SchemaCheckSharedFieldsModel,
  z.union([FailedSchemaCheckPartialModel, SuccessfulSchemaCheckPartialModel]),
);

const PersistedSchemaCheckPartialModel = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FailedSchemaCheckModel = z.intersection(
  SchemaCheckSharedFieldsModel,
  z.intersection(PersistedSchemaCheckPartialModel, FailedSchemaCheckPartialModel),
);

export const SuccessfulSchemaCheckModel = z.intersection(
  SchemaCheckSharedFieldsModel,
  z.intersection(PersistedSchemaCheckPartialModel, SuccessfulSchemaCheckPartialModel),
);

export const SchemaCheckModel = z.union([FailedSchemaCheckModel, SuccessfulSchemaCheckModel]);

export type SchemaCheckInput = z.TypeOf<typeof SchemaCheckInputModel>;
export type SchemaCheck = z.TypeOf<typeof SchemaCheckModel>;
export type FailedSchemaCheck = z.TypeOf<typeof FailedSchemaCheckModel>;
export type SuccessfulSchemaCheck = z.TypeOf<typeof SuccessfulSchemaCheckModel>;

export const TargetBreadcrumbModel = z.object({
  organization: z.string(),
  project: z.string(),
  target: z.string(),
});

export type TargetBreadcrumb = z.TypeOf<typeof TargetBreadcrumbModel>;
