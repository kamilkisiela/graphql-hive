use std::sync::Arc;

use async_graphql::extensions::{Extension, ExtensionFactory};

pub struct GraphQLHive;

impl ExtensionFactory for GraphQLHive {
    fn create(&self) -> Arc<dyn Extension> {
        Arc::new(HiveExtension)
    }
}

struct HiveExtension;

impl Extension for HiveExtension {}

#[cfg(test)]
mod tests {
    use super::*;
    use async_graphql::*;

    struct Query;

    #[Object]
    impl Query {
        async fn foo(&self) -> i32 {
            42
        }
    }

    #[tokio::test]
    async fn registers_correctly() {
        let schema = Schema::build(Query, EmptyMutation, EmptySubscription)
            .extension(GraphQLHive)
            .finish();
        let resp = schema.execute("{ foo }").await;
        assert_eq!(
            resp.data.into_json().unwrap(),
            serde_json::json!({"foo": 42})
        )
    }
}
