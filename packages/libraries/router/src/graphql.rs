use anyhow::anyhow;
use anyhow::Error;
use graphql_tools::ast::ext::SchemaDocumentExtension;
use graphql_tools::ast::FieldByNameExtension;
use graphql_tools::ast::TypeDefinitionExtension;
use graphql_tools::ast::TypeExtension;
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
                    TypeDefinition::Enum(enum_type) => {
                        for value in &enum_type.values {
                            ctx.schema_coordinates.insert(format!(
                                "{}.{}",
                                enum_type.name.as_str(),
                                value.name
                            ));
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

    fn resolve_references(
        &self,
        schema: &SchemaDocument<'static, String>,
        type_name: &str,
    ) -> Option<Vec<String>> {
        let mut visited_types = Vec::new();
        self._resolve_references(schema, type_name, &mut visited_types);
        Some(visited_types)
    }

    fn _resolve_references(
        &self,
        schema: &SchemaDocument<'static, String>,
        type_name: &str,
        visited_types: &mut Vec<String>,
    ) {
        if visited_types.contains(&type_name.to_string()) {
            return;
        }

        visited_types.push(type_name.to_string());

        let named_type = schema.type_by_name(&type_name);

        match named_type {
            Some(named_type) => match named_type {
                TypeDefinition::InputObject(input_type) => {
                    for field in &input_type.fields {
                        let field_type = self.resolve_type_name(field.value_type.clone());
                        self._resolve_references(schema, &field_type, visited_types);
                    }
                }
                _ => {}
            },
            None => {}
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

            if let Some(field_def) = parent_type.field_by_name(&field_name) {
                // if field's type is an enum, we need to collect all possible values
                let field_output_type = info.schema.type_by_name(field_def.field_type.inner_type());
                match field_output_type {
                    Some(TypeDefinition::Enum(enum_type)) => {
                        for value in &enum_type.values {
                            ctx.schema_coordinates.insert(format!(
                                "{}.{}",
                                enum_type.name.as_str(),
                                value.name
                            ));
                        }
                    }
                    _ => {}
                }
            }
        } else {
            ctx.error = Some(anyhow!(
                "Unable to find parent type of '{}' field",
                field.name
            ))
        }
    }

    fn enter_variable_definition(
        &mut self,
        info: &mut OperationVisitorContext<'a>,
        ctx: &mut SchemaCoordinatesContext,
        var: &graphql_tools::static_graphql::query::VariableDefinition,
    ) {
        if ctx.is_corrupted() {
            return ();
        }

        let type_name = self.resolve_type_name(var.var_type.clone());

        if let Some(inner_types) = self.resolve_references(&info.schema, &type_name) {
            for inner_type in inner_types {
                ctx.input_types_to_collect.insert(inner_type);
            }
        }

        ctx.input_types_to_collect.insert(type_name);
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
                            println!("Coordinate: {input_type_name}.{value_str}");
                            ctx.schema_coordinates
                                .insert(format!("{input_type_name}.{value_str}").to_string());
                        }
                        Value::List(_) => {
                            // handled by enter_list_value
                        }
                        Value::Object(_) => {
                            // handled by enter_object_field
                        }
                        Value::Variable(_) => {
                            // handled by enter_variable_definition
                        }
                        _ => {}
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
                    Value::List(_) => {
                        // handled by enter_list_value
                    }
                    Value::Variable(_) => {
                        // handled by enter_variable_definition
                    }
                    Value::Enum(value) => {
                        let value_str = value.to_string();
                        ctx.schema_coordinates
                            .insert(format!("{}.{}", input_type.name(), value_str).to_string());
                    }
                    _ => {
                        ctx.input_types_to_collect
                            .insert(input_type.name().to_string());
                    }
                }
            }
        }
    }

    fn enter_object_value(
        &mut self,
        info: &mut OperationVisitorContext<'a>,
        ctx: &mut SchemaCoordinatesContext,
        object_value: &BTreeMap<String, graphql_tools::static_graphql::query::Value>,
    ) {
        if let Some(TypeDefinition::InputObject(input_object_def)) = info.current_input_type() {
            object_value.iter().for_each(|(name, value)| {
                if let Some(field) = input_object_def
                    .fields
                    .iter()
                    .find(|field| field.name.eq(name))
                {
                    ctx.schema_coordinates.insert(format!(
                        "{}.{}",
                        input_object_def.name.as_str(),
                        field.name.as_str()
                    ));

                    let field_type_name = field.value_type.inner_type();

                    match value {
                        Value::Enum(value) => {
                            // Collect only a specific enum value
                            let value_str = value.to_string();
                            ctx.schema_coordinates
                                .insert(format!("{field_type_name}.{value_str}").to_string());
                        }
                        Value::List(_) => {
                            // handled by enter_list_value
                        }
                        Value::Object(_) => {
                            // handled by enter_object_field
                        }
                        Value::Variable(_) => {
                            // handled by enter_variable_definition
                        }
                        _ => {
                            ctx.input_types_to_collect
                                .insert(field_type_name.to_string());
                        }
                    }
                }
            });
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
    use std::collections::HashSet;

    use graphql_parser::parse_query;
    use graphql_parser::parse_schema;

    use super::collect_schema_coordinates;

    const SCHEMA_SDL: &str = "
        type Query {
            project(selector: ProjectSelectorInput!): Project
            projectsByType(type: ProjectType!): [Project!]!
            projectsByTypes(types: [ProjectType!]!): [Project!]!
            projects(filter: FilterInput, and: [FilterInput!]): [Project!]!
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
            order: [ProjectOrderByInput!]
        }

        input PaginationInput {
            limit: Int
            offset: Int
        }

        input ProjectOrderByInput {
            field: String!
            direction: OrderDirection
        }

        enum OrderDirection {
            ASC
            DESC
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
        }
    ";

    #[test]
    fn basic_test() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();

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
            "ID",
            "Project.id",
            "Project.cleanId",
            "Project.name",
            "Project.type",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
            "ProjectSelectorInput.organization",
            "ProjectSelectorInput.project",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn entire_input() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query projects($filter: FilterInput) {
                projects(filter: $filter) {
                    name
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.filter",
            "Project.name",
            "FilterInput.type",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
            "FilterInput.pagination",
            "PaginationInput.limit",
            "Int",
            "PaginationInput.offset",
            "FilterInput.order",
            "ProjectOrderByInput.field",
            "String",
            "ProjectOrderByInput.direction",
            "OrderDirection.ASC",
            "OrderDirection.DESC",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn entire_input_list() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query projects($filter: FilterInput) {
                projects(and: $filter) {
                    name
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.and",
            "Project.name",
            "FilterInput.type",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
            "FilterInput.pagination",
            "PaginationInput.limit",
            "Int",
            "PaginationInput.offset",
            "FilterInput.order",
            "ProjectOrderByInput.field",
            "String",
            "ProjectOrderByInput.direction",
            "OrderDirection.ASC",
            "OrderDirection.DESC",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn entire_input_and_enum_value() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects($pagination: PaginationInput) {
                projects(and: { pagination: $pagination, type: FEDERATION }) {
                name
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.and",
            "Project.name",
            "PaginationInput.limit",
            "Int",
            "PaginationInput.offset",
            "FilterInput.pagination",
            "FilterInput.type",
            "ProjectType.FEDERATION",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn enum_value_list() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects {
                projectsByTypes(types: [FEDERATION, STITCHING]) {
                name
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projectsByTypes",
            "Query.projectsByTypes.types",
            "Project.name",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn enums_and_scalars_input() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects($limit: Int!, $type: ProjectType!) {
        projects(filter: { pagination: { limit: $limit }, type: $type }) {
          id
        }
      }
        ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.filter",
            "Project.id",
            "Int",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
            "FilterInput.pagination",
            "FilterInput.type",
            "PaginationInput.limit",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn hard_coded_scalars_input() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            {
                projects(filter: { pagination: { limit: 20 } }) {
                    id
                }
            }
        ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.filter",
            "Project.id",
            "FilterInput.pagination",
            "Int",
            "PaginationInput.limit",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn enum_values_object_field() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects($limit: Int!) {
                projects(filter: { pagination: { limit: $limit }, type: FEDERATION }) {
                    id
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.filter",
            "Project.id",
            "Int",
            "FilterInput.pagination",
            "FilterInput.type",
            "PaginationInput.limit",
            "ProjectType.FEDERATION",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn enum_list_inline() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects {
                projectsByTypes(types: [FEDERATION]) {
                    id
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projectsByTypes",
            "Query.projectsByTypes.types",
            "Project.id",
            "ProjectType.FEDERATION",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn enum_list_variable() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document_inline = parse_query::<String>(
            "
            query getProjects($types: [ProjectType!]!) {
                projectsByTypes(types: $types) {
                    id
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document_inline, &schema).unwrap();

        let expected = vec![
            "Query.projectsByTypes",
            "Query.projectsByTypes.types",
            "Project.id",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn enum_values_argument() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects {
                projectsByType(type: FEDERATION) {
                    id
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projectsByType",
            "Query.projectsByType.type",
            "Project.id",
            "ProjectType.FEDERATION",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn arguments() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects($limit: Int!, $type: ProjectType!) {
                projects(filter: { pagination: { limit: $limit }, type: $type }) {
                id
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.filter",
            "Project.id",
            "Int",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
            "FilterInput.pagination",
            "FilterInput.type",
            "PaginationInput.limit",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn skips_argument_directives() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects($limit: Int!, $type: ProjectType!, $includeName: Boolean!) {
                projects(filter: { pagination: { limit: $limit }, type: $type }) {
                id
                ...NestedFragment
                }
            }

            fragment NestedFragment on Project {
                ...IncludeNameFragment @include(if: $includeName)
            }

            fragment IncludeNameFragment on Project {
                name
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.filter",
            "Project.id",
            "Project.name",
            "Int",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
            "Boolean",
            "FilterInput.pagination",
            "FilterInput.type",
            "PaginationInput.limit",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn used_only_input_fields() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects($limit: Int!, $type: ProjectType!) {
                projects(filter: {
                    pagination: { limit: $limit },
                    type: $type
                }) {
                    id
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.filter",
            "Project.id",
            "Int",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
            "FilterInput.pagination",
            "FilterInput.type",
            "PaginationInput.limit",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }

    #[test]
    fn input_object_mixed() {
        let schema = parse_schema::<String>(SCHEMA_SDL).unwrap();
        let document = parse_query::<String>(
            "
            query getProjects($pagination: PaginationInput!, $type: ProjectType!) {
                projects(filter: { pagination: $pagination, type: $type }) {
                    id
                }
            }
            ",
        )
        .unwrap();

        let schema_coordinates = collect_schema_coordinates(&document, &schema).unwrap();

        let expected = vec![
            "Query.projects",
            "Query.projects.filter",
            "Project.id",
            "PaginationInput.limit",
            "Int",
            "PaginationInput.offset",
            "ProjectType.FEDERATION",
            "ProjectType.STITCHING",
            "ProjectType.SINGLE",
            "FilterInput.pagination",
            "FilterInput.type",
        ]
        .into_iter()
        .map(|s| s.to_string())
        .collect::<HashSet<String>>();

        let extra: Vec<&String> = schema_coordinates.difference(&expected).collect();
        let missing: Vec<&String> = expected.difference(&schema_coordinates).collect();

        assert_eq!(extra.len(), 0, "Extra: {:?}", extra);
        assert_eq!(missing.len(), 0, "Missing: {:?}", missing);
    }
}
