use crate::agent::{ExecutionReport, UsageAgent};
use apollo_router::layers::ServiceBuilderExt;
use apollo_router::plugin::Plugin;
use apollo_router::plugin::PluginInit;
use apollo_router::register_plugin;
use apollo_router::services::*;
use apollo_router::Context;
use core::ops::Drop;
use futures::StreamExt;
use http::HeaderValue;
use rand::Rng;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Instant;
use std::time::{SystemTime, UNIX_EPOCH};
use tower::BoxError;
use tower::ServiceBuilder;
use tower::ServiceExt;

pub(crate) static OPERATION_CONTEXT: &str = "hive::operation_context";

#[derive(Serialize, Deserialize)]
struct OperationContext {
    pub(crate) client_name: Option<String>,
    pub(crate) client_version: Option<String>,
    pub(crate) timestamp: u64,
    pub(crate) operation_body: String,
    pub(crate) operation_name: Option<String>,
    pub(crate) dropped: bool,
}

struct UsagePlugin {
    config: Config,
    agent: Option<Arc<Mutex<UsageAgent>>>,
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
struct Config {
    /// Default: true
    enabled: Option<bool>,
    /// Sample rate to determine sampling.
    /// 0.0 = 0% chance of being sent
    /// 1.0 = 100% chance of being sent.
    /// Default: 1.0
    sample_rate: Option<f64>,
    /// A list of operations (by name) to be ignored by GraphQL Hive.
    exclude: Option<Vec<String>>,
    client_name_header: Option<String>,
    client_version_header: Option<String>,
    /// A maximum number of operations to hold in a buffer before sending to GraphQL Hive
    /// Default: 1000
    buffer_size: Option<usize>,
    /// A timeout for only the connect phase of a request to GraphQL Hive
    /// Default: 5 (s)
    connect_timeout: Option<u64>,
    /// A timeout for the entire request to GraphQL Hive
    /// Default: 15 (s)
    request_timeout: Option<u64>,
    /// Accept invalid SSL certificates
    /// Default: false
    accept_invalid_certs: Option<bool>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: Some(true),
            sample_rate: Some(1.0),
            exclude: None,
            client_name_header: None,
            client_version_header: None,
            accept_invalid_certs: Some(false),
            buffer_size: Some(1000),
            connect_timeout: Some(5000),
            request_timeout: Some(15000),
        }
    }
}

impl UsagePlugin {
    fn populate_context(config: Config, req: &supergraph::Request) {
        let context = &req.context;
        let http_request = &req.supergraph_request;
        let headers = http_request.headers();

        let client_name_header = config
            .client_name_header
            .unwrap_or("graphql-client-name".to_string());
        let client_version_header = config
            .client_version_header
            .unwrap_or("graphql-client-version".to_string());

        let get_header_value = |key: &str| {
            headers
                .get(key)
                .cloned()
                .unwrap_or_else(|| HeaderValue::from_static(""))
                .to_str()
                .ok()
                .map(|v| v.to_string())
        };

        let client_name = get_header_value(&client_name_header);
        let client_version = get_header_value(&client_version_header);

        let operation_name = req.supergraph_request.body().operation_name.clone();
        let operation_body = req
            .supergraph_request
            .body()
            .query
            .clone()
            .expect("operation body should not be empty");

        let sample_rate = config.sample_rate.clone();
        let excluded_operation_names: HashSet<String> = config
            .exclude
            .unwrap_or_else(|| vec![])
            .clone()
            .into_iter()
            .collect();

        let mut rng = rand::thread_rng();
        let mut dropped = match sample_rate {
            Some(rate) => {
                let num: f64 = rng.gen();
                num > rate
            }
            None => false,
        };

        if !dropped {
            match &operation_name {
                Some(name) => {
                    if excluded_operation_names.contains(name) {
                        dropped = true;
                    }
                }
                None => {}
            }
        }

        let _ = context.insert(
            OPERATION_CONTEXT,
            OperationContext {
                dropped,
                client_name,
                client_version,
                operation_name,
                operation_body,
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs()
                    * 1000,
            },
        );
    }
}

#[async_trait::async_trait]
impl Plugin for UsagePlugin {
    type Config = Config;

    async fn new(init: PluginInit<Config>) -> Result<Self, BoxError> {
        tracing::info!("Starting GraphQL Hive Usage plugin");
        let token =
            env::var("HIVE_TOKEN").map_err(|_| "environment variable HIVE_TOKEN not found")?;
        let endpoint = env::var("HIVE_ENDPOINT");
        let endpoint = match endpoint {
            Ok(endpoint) => endpoint,
            Err(_) => "https://app.graphql-hive.com/usage".to_string(),
        };

        let default_config = Config::default();
        let enabled = init.config.enabled.or(default_config.enabled).expect("enabled has default value");
        let buffer_size = init.config.buffer_size.or(default_config.buffer_size).expect("buffer_size has default value");
        let accept_invalid_certs = init.config.accept_invalid_certs.or(default_config.accept_invalid_certs).expect("accept_invalid_certs has default value");
        let connect_timeout = init.config.connect_timeout.or(default_config.connect_timeout).expect("connect_timeout has default value");
        let request_timeout = init.config.request_timeout.or(default_config.request_timeout).expect("request_timeout has default value");


        Ok(UsagePlugin {
            config: init.config,
            agent: match enabled {
                true => Some(Arc::new(Mutex::new(UsageAgent::new(
                    init.supergraph_sdl.to_string(),
                    token,
                    endpoint,
                    buffer_size,
                    connect_timeout,
                    request_timeout,
                    accept_invalid_certs,
                )))),
                false => None,
            },
        })
    }

    fn supergraph_service(&self, service: supergraph::BoxService) -> supergraph::BoxService {
        let config = self.config.clone();
        match self.agent.clone() {
            None => ServiceBuilder::new().service(service).boxed(),
            Some(agent) => {
                ServiceBuilder::new()
                .map_future_with_request_data(
                    move |req: &supergraph::Request| {
                        Self::populate_context(config.clone(), req);
                        req.context.clone()
                    },
                    move |ctx: Context, fut| {
                        let agent_clone = agent.clone();
                        async move {
                            let start = Instant::now();
    
                            // nested async block, bc async is unstable with closures that receive arguments
                            let operation_context = ctx
                                .get::<_, OperationContext>(OPERATION_CONTEXT)
                                .unwrap_or_default()
                                .unwrap();
    
                            let result: supergraph::ServiceResult = fut.await;
    
                            if operation_context.dropped {
                                tracing::debug!("Dropping operation (phase: SAMPLING): {}", operation_context.operation_name.clone().or_else(|| Some("anonymous".to_string())).unwrap());
                                return result;
                            }
    
                            let OperationContext {
                                client_name,
                                client_version,
                                operation_name,
                                timestamp,
                                operation_body,
                                ..
                            } = operation_context;
    
                            let duration = start.elapsed();
    
                            match result {
                                Err(e) => {
                                    agent_clone
                                        .clone()
                                        .lock()
                                        .expect("Unable to acquire Agent in supergraph_service (error)")
                                        .add_report(ExecutionReport {
                                            client_name,
                                            client_version,
                                            timestamp,
                                            duration,
                                            ok: false,
                                            errors: 1,
                                            operation_body,
                                            operation_name,
                                        });
                                    Err(e)
                                }
                                Ok(router_response) => {
                                    let is_failure = !router_response.response.status().is_success();
                                    Ok(router_response.map(move |response_stream| {
                                        let client_name = client_name.clone();
                                        let client_version = client_version.clone();
                                        let operation_body = operation_body.clone();
                                        let operation_name = operation_name.clone();
    
                                        let res = response_stream
                                            .map(move |response| {
                                                // make sure we send a single report, not for each chunk
                                                let response_has_errors = !response.errors.is_empty();
                                                agent_clone.clone().lock()
                                                .expect("Unable to acquire Agent in supergraph_service (ok)").add_report(ExecutionReport {
                                                    client_name: client_name.clone(),
                                                    client_version: client_version.clone(),
                                                    timestamp,
                                                    duration,
                                                    ok: !is_failure && !response_has_errors,
                                                    errors: response.errors.len(),
                                                    operation_body: operation_body.clone(),
                                                    operation_name: operation_name.clone(),
                                                });
    
                                                response
                                            })
                                            .boxed();
    
                                        res
                                    }))
                                }
                            }
                        }
                    },
                )
                .service(service)
                .boxed()
            }
        }
    }
}

impl Drop for UsagePlugin {
    fn drop(&mut self) {
        tracing::debug!("UsagePlugin has been dropped!");
        // TODO: flush the buffer
    }
}

// Register the hive.usage plugin
pub fn register() {
    register_plugin!("hive", "usage", UsagePlugin);
}
