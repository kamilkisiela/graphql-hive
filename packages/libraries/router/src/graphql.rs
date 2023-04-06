use anyhow::anyhow;
use anyhow::Error;
use graphql_tools::ast::ext::SchemaDocumentExtension;
use graphql_tools::ast::TypeDefinitionExtension;
use lru::LruCache;
use md5;
use std::cmp::Ordering;
use std::collections::BTreeMap;
use std::collections::HashMap;
use std::collections::HashSet;
use std::num::NonZeroUsize;

use graphql_parser::minify_query;
use graphql_parser::parse_query;
use graphql_parser::query::{
    Definition, Directive, Document, Field, FragmentDefinition, Number, OperationDefinition,
    Selection, SelectionSet, Text, Type, Value, VariableDefinition,
};
use graphql_parser::schema::{Document as SchemaDocument, TypeDefinition};
use graphql_tools::ast::{
    visit_document, OperationTransformer, OperationVisitor, OperationVisitorContext, Transformed,
    TransformedValue,
};

struct SchemaCoordinatesContext {
    pub schema_coordinates: HashSet<String>,
    pub input_types_to_collect: HashSet<String>,
    error: Option<Error>,
}

impl SchemaCoordinatesContext {
    fn is_corrupted(&self) -> bool {
        self.error.is_some()
    }
}

pub fn collect_schema_coordinates(
    document: &Document<'static, String>,
    schema: &SchemaDocument<'static, String>,
) -> Result<HashSet<String>, Error> {
    let mut ctx = SchemaCoordinatesContext {
        schema_coordinates: HashSet::new(),
        input_types_to_collect: HashSet::new(),
        error: None,
    };
    let mut visit_context = OperationVisitorContext::new(document, schema);
    let mut visitor = SchemaCoordinatesVisitor {};

    visit_document(&mut visitor, &document, &mut visit_context, &mut ctx);

    if let Some(error) = ctx.error {
        Err(error)
    } else {
        for input_type_name in ctx.input_types_to_collect {
            let named_type = schema.type_by_name(&input_type_name);

            match named_type {
                Some(named_type) => match named_type {
                    TypeDefinition::InputObject(input_type) => {
                        for field in &input_type.fields {
                            ctx.schema_coordinates
                                .insert(format!("{}.{}", input_type_name, field.name));
                        }
                    }
                    _ => {}
                },
                None => {
                    ctx.schema_coordinates.insert(input_type_name);
                }
            }
        }

        Ok(ctx.schema_coordinates)
    }
}

struct SchemaCoordinatesVisitor {}

impl SchemaCoordinatesVisitor {
    fn resolve_type_name<'a>(&self, t: Type<'a, String>) -> String {
        match t {
            Type::NamedType(value) => return value,
            Type::ListType(t) => return self.resolve_type_name(*t),
            Type::NonNullType(t) => return self.resolve_type_name(*t),
        }
    }
}

impl<'a> OperationVisitor<'a, SchemaCoordinatesContext> for SchemaCoordinatesVisitor {
    fn enter_field(
        &mut self,
        info: &mut OperationVisitorContext<'a>,
        ctx: &mut SchemaCoordinatesContext,
        field: &Field<'static, String>,
    ) {
        if ctx.is_corrupted() {
            return ();
        }

        let field_name = field.name.to_string();

        if let Some(parent_type) = info.current_parent_type() {
            let parent_name = parent_type.name();

            ctx.schema_coordinates
                .insert(format!("{}.{}", parent_name, field_name));
        } else {
            ctx.error = Some(anyhow!(
                "Unable to find parent type of '{}' field",
                field.name
            ))
        }
    }

    fn enter_variable_definition(
        &mut self,
        _: &mut OperationVisitorContext<'a>,
        ctx: &mut SchemaCoordinatesContext,
        var: &graphql_tools::static_graphql::query::VariableDefinition,
    ) {
        if ctx.is_corrupted() {
            return ();
        }
        ctx.input_types_to_collect
            .insert(self.resolve_type_name(var.var_type.clone()));
    }

    fn enter_argument(
        &mut self,
        info: &mut OperationVisitorContext<'a>,
        ctx: &mut SchemaCoordinatesContext,
        arg: &(String, Value<'static, String>),
    ) {
        if ctx.is_corrupted() {
            return ();
        }

        if info.current_parent_type().is_none() {
            ctx.error = Some(anyhow!(
                "Unable to find parent type of '{}' argument",
                arg.0.clone()
            ));
            return ();
        }

        let type_name = info.current_parent_type().unwrap().name();

        let field = info.current_field();

        if let Some(field) = field {
            let field_name = field.name.clone();
            let arg_name = arg.0.clone();

            ctx.schema_coordinates
                .insert(format!("{type_name}.{field_name}.{arg_name}").to_string());

            let arg_value = arg.1.clone();

            match info.current_input_type() {
                Some(input_type) => {
                    let input_type_name = input_type.name();
                    match arg_value {
                        Value::Enum(value) => {
                            let value_str = value.to_string();
                            ctx.schema_coordinates
                                .insert(format!("{input_type_name}.{value_str}").to_string());
                        }
                        Value::List(_) => {
                            // handled by enter_list_value
                        }
                        Value::Object(_) => {
                            // handled by enter_object_field
                        }
                        _ => {
                            ctx.input_types_to_collect
                                .insert(input_type_name.to_string());
                        }
                    }
                }
                None => {}
            }
        }
    }

    fn enter_list_value(
        &mut self,
        info: &mut OperationVisitorContext<'a>,
        ctx: &mut SchemaCoordinatesContext,
        values: &Vec<Value<'static, String>>,
    ) {
        if ctx.is_corrupted() {
            return ();
        }

        if let Some(input_type) = info.current_input_type() {
            for value in values {
                match value {
                    Value::Object(_) => {
                        // object fields are handled by enter_object_field
                    }
                    _ => {
                        ctx.input_types_to_collect
                            .insert(input_type.name().to_string());
                    }
                }
            }
        }
    }

    fn enter_object_field(
        &mut self,
        info: &mut OperationVisitorContext<'a>,
        ctx: &mut SchemaCoordinatesContext,
        (name, value): &(String, Value<'static, String>),
    ) {
        if ctx.is_corrupted() {
            return ();
        }

        let input_type = info.current_input_type();

        if let Some(input_type) = input_type {
            ctx.schema_coordinates
                .insert(format!("{}.{}", input_type.name(), name));

            let input_type_name = input_type.name();
            match value {
                Value::Enum(value) => {
                    // Collect only a specific enum value
                    let value_str = value.to_string();
                    ctx.schema_coordinates
                        .insert(format!("{input_type_name}.{value_str}").to_string());
                }
                Value::List(_) => {
                    // handled by enter_list_value
                }
                Value::Object(_) => {
                    // handled by enter_object_field
                }
                _ => {
                    ctx.input_types_to_collect
                        .insert(input_type_name.to_string());
                }
            }
        }
    }
}

struct StripLiteralsTransformer {}

impl<'a, T: Text<'a> + Clone> OperationTransformer<'a, T> for StripLiteralsTransformer {
    fn transform_value(&mut self, node: &Value<'a, T>) -> TransformedValue<Value<'a, T>> {
        match node {
            Value::Float(_) => TransformedValue::Replace(Value::Float(0.0)),
            Value::Int(_) => TransformedValue::Replace(Value::Int(Number::from(0))),
            Value::String(_) => TransformedValue::Replace(Value::String(String::from(""))),
            Value::Variable(_) => TransformedValue::Keep,
            Value::Boolean(_) => TransformedValue::Keep,
            Value::Null => TransformedValue::Keep,
            Value::Enum(_) => TransformedValue::Keep,
            Value::List(val) => {
                let items: Vec<Value<'a, T>> = val
                    .iter()
                    .map(|item| self.transform_value(item).replace_or_else(|| item.clone()))
                    .collect();

                TransformedValue::Replace(Value::List(items))
            }
            Value::Object(fields) => {
                let fields: BTreeMap<T::Value, Value<'a, T>> = fields
                    .iter()
                    .map(|field| {
                        let (name, value) = field;
                        let new_value = self
                            .transform_value(value)
                            .replace_or_else(|| value.clone());
                        (name.clone(), new_value)
                    })
                    .collect();

                TransformedValue::Replace(Value::Object(fields))
            }
        }
    }

    fn transform_field(
        &mut self,
        field: &graphql_parser::query::Field<'a, T>,
    ) -> Transformed<graphql_parser::query::Selection<'a, T>> {
        let selection_set = self.transform_selection_set(&field.selection_set);
        let arguments = self.transform_arguments(&field.arguments);
        let directives = self.transform_directives(&field.directives);

        Transformed::Replace(Selection::Field(Field {
            arguments: arguments.replace_or_else(|| field.arguments.clone()),
            directives: directives.replace_or_else(|| field.directives.clone()),
            selection_set: SelectionSet {
                items: selection_set.replace_or_else(|| field.selection_set.items.clone()),
                span: field.selection_set.span,
            },
            position: field.position,
            alias: None,
            name: field.name.clone(),
        }))
    }
}

#[derive(Hash, Eq, PartialEq, Clone, Copy)]
pub struct PointerAddress(usize);

impl PointerAddress {
    pub fn new<T>(ptr: &T) -> Self {
        let ptr_address: usize = unsafe { std::mem::transmute(ptr) };
        Self(ptr_address)
    }
}

type Seen<'s, T> = HashMap<PointerAddress, Transformed<Selection<'s, T>>>;

pub struct SortSelectionsTransform<'s, T: Text<'s> + Clone> {
    seen: Seen<'s, T>,
}

impl<'s, T: Text<'s> + Clone> SortSelectionsTransform<'s, T> {
    pub fn new() -> Self {
        Self {
            seen: Default::default(),
        }
    }
}

impl<'s, T: Text<'s> + Clone> OperationTransformer<'s, T> for SortSelectionsTransform<'s, T> {
    fn transform_document(
        &mut self,
        document: &Document<'s, T>,
    ) -> TransformedValue<Document<'s, T>> {
        let mut next_definitions = self
            .transform_list(&document.definitions, Self::transform_definition)
            .replace_or_else(|| document.definitions.to_vec());
        next_definitions.sort_unstable_by(|a, b| self.compare_definitions(a, b));
        TransformedValue::Replace(Document {
            definitions: next_definitions,
        })
    }

    fn transform_selection_set(
        &mut self,
        selections: &SelectionSet<'s, T>,
    ) -> TransformedValue<Vec<Selection<'s, T>>> {
        let mut next_selections = self
            .transform_list(&selections.items, Self::transform_selection)
            .replace_or_else(|| selections.items.to_vec());
        next_selections.sort_unstable_by(|a, b| self.compare_selections(a, b));
        TransformedValue::Replace(next_selections)
    }

    fn transform_directives(
        &mut self,
        directives: &Vec<Directive<'s, T>>,
    ) -> TransformedValue<Vec<Directive<'s, T>>> {
        let mut next_directives = self
            .transform_list(&directives, Self::transform_directive)
            .replace_or_else(|| directives.to_vec());
        next_directives.sort_unstable_by(|a, b| self.compare_directives(a, b));
        TransformedValue::Replace(next_directives)
    }

    fn transform_arguments(
        &mut self,
        arguments: &[(T::Value, Value<'s, T>)],
    ) -> TransformedValue<Vec<(T::Value, Value<'s, T>)>> {
        let mut next_arguments = self
            .transform_list(&arguments, Self::transform_argument)
            .replace_or_else(|| arguments.to_vec());
        next_arguments.sort_unstable_by(|a, b| self.compare_arguments(a, b));
        TransformedValue::Replace(next_arguments)
    }

    fn transform_variable_definitions(
        &mut self,
        variable_definitions: &Vec<VariableDefinition<'s, T>>,
    ) -> TransformedValue<Vec<VariableDefinition<'s, T>>> {
        let mut next_variable_definitions = self
            .transform_list(&variable_definitions, Self::transform_variable_definition)
            .replace_or_else(|| variable_definitions.to_vec());
        next_variable_definitions.sort_unstable_by(|a, b| self.compare_variable_definitions(a, b));
        TransformedValue::Replace(next_variable_definitions)
    }

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition<'s, T>,
    ) -> Transformed<FragmentDefinition<'s, T>> {
        let mut directives = fragment.directives.clone();
        directives.sort_unstable_by_key(|var| var.name.clone());

        let selections = self.transform_selection_set(&fragment.selection_set);

        Transformed::Replace(FragmentDefinition {
            selection_set: SelectionSet {
                items: selections.replace_or_else(|| fragment.selection_set.items.clone()),
                span: fragment.selection_set.span.clone(),
            },
            directives,
            name: fragment.name.clone(),
            position: fragment.position.clone(),
            type_condition: fragment.type_condition.clone(),
        })
    }

    fn transform_selection(
        &mut self,
        selection: &Selection<'s, T>,
    ) -> Transformed<Selection<'s, T>> {
        match selection {
            Selection::InlineFragment(selection) => {
                let key = PointerAddress::new(selection);
                if let Some(prev) = self.seen.get(&key) {
                    return prev.clone();
                }
                let transformed = self.transform_inline_fragment(selection);
                self.seen.insert(key, transformed.clone());
                transformed
            }
            Selection::Field(field) => {
                let key = PointerAddress::new(field);
                if let Some(prev) = self.seen.get(&key) {
                    return prev.clone();
                }
                let transformed = self.transform_field(field);
                self.seen.insert(key, transformed.clone());
                transformed
            }
            Selection::FragmentSpread(_) => Transformed::Keep,
        }
    }
}

impl<'s, T: Text<'s> + Clone> SortSelectionsTransform<'s, T> {
    fn compare_definitions(&self, a: &Definition<'s, T>, b: &Definition<'s, T>) -> Ordering {
        match (a, b) {
            // Keep operations as they are
            (Definition::Operation(_), Definition::Operation(_)) => Ordering::Equal,
            // Sort fragments by name
            (Definition::Fragment(a), Definition::Fragment(b)) => a.name.cmp(&b.name),
            // Operation -> Fragment
            _ => definition_kind_ordering(a).cmp(&definition_kind_ordering(b)),
        }
    }

    fn compare_selections(&self, a: &Selection<'s, T>, b: &Selection<'s, T>) -> Ordering {
        match (a, b) {
            (Selection::Field(a), Selection::Field(b)) => a.name.cmp(&b.name),
            (Selection::FragmentSpread(a), Selection::FragmentSpread(b)) => {
                a.fragment_name.cmp(&b.fragment_name)
            }
            _ => {
                let a_ordering = selection_kind_ordering(a);
                let b_ordering = selection_kind_ordering(b);
                a_ordering.cmp(&b_ordering)
            }
        }
    }
    fn compare_directives(&self, a: &Directive<'s, T>, b: &Directive<'s, T>) -> Ordering {
        a.name.cmp(&b.name)
    }
    fn compare_arguments(
        &self,
        a: &(T::Value, Value<'s, T>),
        b: &(T::Value, Value<'s, T>),
    ) -> Ordering {
        a.0.cmp(&b.0)
    }
    fn compare_variable_definitions(
        &self,
        a: &VariableDefinition<'s, T>,
        b: &VariableDefinition<'s, T>,
    ) -> Ordering {
        a.name.cmp(&b.name)
    }
}

/// Assigns an order to different variants of Selection.
fn selection_kind_ordering<'s, T: Text<'s>>(selection: &Selection<'s, T>) -> u8 {
    match selection {
        Selection::FragmentSpread(_) => 1,
        Selection::InlineFragment(_) => 2,
        Selection::Field(_) => 3,
    }
}

/// Assigns an order to different variants of Definition
fn definition_kind_ordering<'a, T: Text<'a>>(definition: &Definition<'a, T>) -> u8 {
    match definition {
        Definition::Operation(_) => 1,
        Definition::Fragment(_) => 2,
    }
}

#[derive(Clone)]
pub struct ProcessedOperation {
    pub operation: String,
    pub hash: String,
    pub coordinates: Vec<String>,
}

pub struct OperationProcessor {
    cache: LruCache<String, Option<ProcessedOperation>>,
}

impl OperationProcessor {
    pub fn new() -> OperationProcessor {
        OperationProcessor {
            cache: LruCache::new(NonZeroUsize::new(1000).unwrap()),
        }
    }

    pub fn process(
        &mut self,
        query: &str,
        schema: &SchemaDocument<'static, String>,
    ) -> Result<Option<ProcessedOperation>, String> {
        let key = query.to_string();
        if self.cache.contains(&key) {
            Ok(self
                .cache
                .get(&key)
                .expect("Unable to acquire Cache in OperationProcessor.process")
                .clone())
        } else {
            let result = self.transform(query, schema)?;
            self.cache.put(key, result.clone());
            Ok(result)
        }
    }

    fn transform(
        &self,
        operation: &str,
        schema: &SchemaDocument<'static, String>,
    ) -> Result<Option<ProcessedOperation>, String> {
        let mut strip_literals_transformer = StripLiteralsTransformer {};
        let parsed = parse_query(operation)
            .map_err(|e| e.to_string())?
            .into_static();

        let is_introspection = parsed.definitions.iter().find(|def| match def {
            Definition::Operation(op) => match op {
                OperationDefinition::Query(query) => query
                    .selection_set
                    .items
                    .iter()
                    .find(|selection| match selection {
                        Selection::Field(field) => {
                            field.name == "__schema" || field.name == "__type"
                        }
                        _ => false,
                    })
                    .is_some(),
                _ => false,
            },
            _ => false,
        });

        if is_introspection.is_some() {
            return Ok(None);
        }

        let schema_coordinates_result =
            collect_schema_coordinates(&parsed, schema).map_err(|e| e.to_string())?;

        let schema_coordinates: Vec<String> = Vec::from_iter(schema_coordinates_result);

        let normalized = strip_literals_transformer
            .transform_document(&parsed)
            .replace_or_else(|| parsed.clone());

        let normalized = SortSelectionsTransform::new()
            .transform_document(&normalized)
            .replace_or_else(|| normalized.clone());

        let printed = minify_query(format!("{}", normalized.clone())).map_err(|e| e.to_string())?;
        let hash = format!("{:x}", md5::compute(printed.clone()));

        Ok(Some(ProcessedOperation {
            operation: printed,
            hash,
            coordinates: schema_coordinates,
        }))
    }
}

#[cfg(test)]
mod tests {
    use graphql_parser::parse_query;
    use graphql_parser::parse_schema;

    use super::collect_schema_coordinates;

    #[test]
    fn basic_test() {
        let schema = parse_schema::<String>(
            "
            type Query {
                project(selector: ProjectSelectorInput!): Project
                projectsByType(type: ProjectType!): [Project!]!
                projects(filter: FilterInput): [Project!]!
            }
            type Mutation {
                deleteProject(selector: ProjectSelectorInput!): DeleteProjectPayload!
            }
            input ProjectSelectorInput {
                organization: ID!
                project: ID!
            }
            input FilterInput {
                type: ProjectType
                pagination: PaginationInput
            }
            input PaginationInput {
                limit: Int
                offset: Int
            }
            type ProjectSelector {
                organization: ID!
                project: ID!
            }
            type DeleteProjectPayload {
                selector: ProjectSelector!
                deletedProject: Project!
            }
            type Project {
                id: ID!
                cleanId: ID!
                name: String!
                type: ProjectType!
                buildUrl: String
                validationUrl: String
            }
            enum ProjectType {
                FEDERATION
                STITCHING
                SINGLE
                CUSTOM
            }
        ",
        )
        .unwrap();

        let document = parse_query::<String>(
            "
            mutation deleteProjectOperation($selector: ProjectSelectorInput!) {
                deleteProject(selector: $selector) {
                    selector {
                        organization
                        project
                    }
                    deletedProject {
                        ...ProjectFields
                    }
                }
            }
            fragment ProjectFields on Project {
                id
                cleanId
                name
                type
            }
        ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Mutation.deleteProject",
            "Mutation.deleteProject.selector",
            "DeleteProjectPayload.selector",
            "ProjectSelector.organization",
            "ProjectSelector.project",
            "DeleteProjectPayload.deletedProject",
            "Project.id",
            "Project.cleanId",
            "Project.name",
            "Project.type",
            "ProjectSelectorInput.organization",
            "ProjectSelectorInput.project",
        ];

        for exp in expected {
            assert_eq!(schema_coordinates.get(exp), Some(&exp.to_string()));
        }

        assert_eq!(schema_coordinates.len(), 12);
    }
}
