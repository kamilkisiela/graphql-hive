use async_graphql::{Context, Object, Schema, SimpleObject};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{routing::get, routing::post, Extension, Router};
use graphql_hive_async_graphql_extension::GraphQLHive;
use tokio::net::TcpListener;

#[derive(SimpleObject)]
struct Greeting {
    message: String,
}

struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn hello(&self, _ctx: &Context<'_>) -> Greeting {
        Greeting {
            message: "Hello from Axum and async-graphql!".to_string(),
        }
    }
}

type MySchema = Schema<QueryRoot, async_graphql::EmptyMutation, async_graphql::EmptySubscription>;

#[tokio::main]
async fn main() {
    let schema = Schema::build(
        QueryRoot,
        async_graphql::EmptyMutation,
        async_graphql::EmptySubscription,
    )
    .finish();

    let app = Router::new()
        .route("/graphql", post(graphql_handler))
        .route("/", get(graphql_playground))
        .layer(Extension(schema));

    let listener = TcpListener::bind("0.0.0.0:8080").await.unwrap();

    println!("Server running at http://localhost:8080");
    axum::serve(listener, app).await.unwrap();
}

async fn graphql_handler(schema: Extension<MySchema>, req: GraphQLRequest) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

async fn graphql_playground() -> axum::response::Html<String> {
    axum::response::Html(async_graphql::http::playground_source(
        async_graphql::http::GraphQLPlaygroundConfig::new("/graphql"),
    ))
}
