use std::convert::Infallible;

use axum_core::extract::FromRequestParts;
use http::request::Parts;

use super::GraphQLHiveContext;

#[async_trait::async_trait]
impl<S> FromRequestParts<S> for GraphQLHiveContext
where
    S: Send + Sync,
{
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let get_header_string = |name: &str| {
            parts
                .headers
                .get(name)
                .and_then(|v| v.to_str().ok())
                .map(|v| v.to_owned())
        };

        let client_name = get_header_string("graphql-client-name");
        let client_version = get_header_string("graphql-client-version");

        Ok(GraphQLHiveContext::new(client_name, client_version))
    }
}
