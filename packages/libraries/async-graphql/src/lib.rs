use std::{sync::Arc, time::Instant};

use async_graphql::{
    extensions::{Extension, ExtensionContext, ExtensionFactory, NextExecute, NextPrepareRequest},
    Request, Response, ServerResult,
};
use context::{GraphQLHiveContext, HiveInternalContext};

pub mod context;
mod usage;

pub struct GraphQLHive {
    pub usage: usage::UsageConfig,
}

impl Default for GraphQLHive {
    fn default() -> Self {
        Self {
            usage: usage::UsageConfigBuilder::default().build().unwrap(),
        }
    }
}

impl ExtensionFactory for GraphQLHive {
    fn create(&self) -> Arc<dyn Extension> {
        Arc::new(HiveExtension {
            usage_reporter: Arc::new(usage::UsageReporter::new(self.usage.clone())),
        })
    }
}

struct HiveExtension {
    usage_reporter: Arc<usage::UsageReporter>,
}

#[async_trait::async_trait]
impl Extension for HiveExtension {
    async fn prepare_request(
        &self,
        ctx: &ExtensionContext<'_>,
        request: Request,
        next: NextPrepareRequest<'_>,
    ) -> ServerResult<Request> {
        self.usage_reporter.prepare_agent(|| ctx.sdl());
        let operation_name = request.operation_name.clone();
        let operation_body = request.query.clone();
        let request = request.data(HiveInternalContext {
            operation_name,
            operation_body,
            start: Instant::now(),
        });
        next.run(ctx, request).await
    }

    async fn execute(
        &self,
        ctx: &ExtensionContext<'_>,
        operation_name: Option<&str>,
        next: NextExecute<'_>,
    ) -> Response {
        let response: Response = next.run(ctx, operation_name).await;
        let public_ctx = ctx.data_opt::<GraphQLHiveContext>();
        let internal_ctx = ctx.data_opt::<HiveInternalContext>();

        if let (Some(public_ctx), Some(internal_ctx)) = (public_ctx, internal_ctx) {
            let reporter = self.usage_reporter.clone();
            let public_ctx = public_ctx.clone();
            let internal_ctx = internal_ctx.clone();
            let duration = internal_ctx.start.elapsed();
            let errors = response.errors.len();
            let ok = errors == 0;

            tokio::spawn(async move {
                reporter
                    .process(public_ctx, internal_ctx, duration, ok, errors)
                    .await;
            });
        }

        response
    }
}

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
            .extension(GraphQLHive {
                usage: usage::UsageConfigBuilder::default()
                    .token("token".to_string())
                    .build()
                    .unwrap(),
            })
            .finish();
        let resp = schema.execute("{ foo }").await;
        assert_eq!(
            resp.data.into_json().unwrap(),
            serde_json::json!({"foo": 42})
        )
    }
}
