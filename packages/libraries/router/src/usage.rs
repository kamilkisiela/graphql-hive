use apollo_router::layers::ServiceBuilderExt;
use apollo_router::plugin::Plugin;
use apollo_router::plugin::PluginInit;
use apollo_router::register_plugin;
use apollo_router::services::RouterRequest;
use apollo_router::services::RouterResponse;
use apollo_router::Context;
use core::ops::Drop;
use futures::StreamExt;
use http::HeaderValue;
use rand::Rng;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;
use std::time::Instant;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;
use tokio::sync::oneshot;
use tower::util::BoxService;
use tower::BoxError;
use tower::ServiceBuilder;
use tower::ServiceExt;

use crate::agent::{ExecutionReport, UsageAgent};

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
    #[allow(dead_code)]
    config: Config,
    agent: UsageAgent,
    shutdown_signal: Option<oneshot::Sender<()>>,
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
struct Config {
    /// Sample rate to determine sampling.
    /// 0.0 = 0% chance of being sent
    /// 1.0 = 100% chance of being sent.
    /// Default: 1.0
    sample_rate: Option<f64>,
    /// A list of operations (by name) to be ignored by Hive.
    exclude: Option<Vec<String>>,
    client_name_header: Option<String>,
    client_version_header: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            sample_rate: Some(1.0),
            exclude: None,
            client_name_header: None,
            client_version_header: None,
        }
    }
}

impl UsagePlugin {
    fn populate_context(config: Config, req: &RouterRequest) {
        let context = &req.context;
        let http_request = &req.originating_request;
        let headers = http_request.headers();
        let client_name_header = config
            .client_name_header
            .unwrap_or("graphql-client-name".to_string());
        let client_version_header = config
            .client_version_header
            .unwrap_or("graphql-client-version".to_string());

        let client_name = headers
            .get(client_name_header)
            .cloned()
            .unwrap_or_else(|| HeaderValue::from_static(""))
            .to_str()
            .ok()
            .map(|v| v.to_string());

        let client_version = headers
            .get(client_version_header)
            .cloned()
            .unwrap_or_else(|| HeaderValue::from_static(""))
            .to_str()
            .ok()
            .map(|v| v.to_string());

        let operation_name = req.originating_request.body().operation_name.clone();
        let operation_body = req
            .originating_request
            .body()
            .query
            .clone()
            .expect("operation body");

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
                num <= rate
            }
            None => false,
        };

        if !dropped {
            match operation_name.clone() {
                Some(name) => {
                    if excluded_operation_names.contains(&name) {
                        dropped = true;
                    }
                }
                None => {}
            }
        }

        if dropped {
            tracing::debug!("Dropped the operation");
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

    pub fn add_report(sender: mpsc::Sender<ExecutionReport>, report: ExecutionReport) {
        if let Err(e) = sender.to_owned().try_send(report) {
            tracing::error!("Failed to send report: {}", e);
        }
    }
}

#[async_trait::async_trait]
impl Plugin for UsagePlugin {
    type Config = Config;

    async fn new(init: PluginInit<Self::Config>) -> Result<Self, BoxError> {
        tracing::debug!("Starting GraphQL Hive Usage plugin");
        let token = env::var("HIVE_TOKEN").map_err(|e| e.to_string())?;
        let endpoint = env::var("HIVE_ENDPOINT");
        let endpoint = match endpoint {
            Ok(endpoint) => endpoint,
            Err(_) => "https://app.graphql-hive.com/usage".to_string(),
        };

        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        Ok(UsagePlugin {
            config: init.config,
            agent: UsageAgent::new(
                init.supergraph_sdl.to_string(),
                token,
                endpoint,
                Some(shutdown_rx),
            ),
            shutdown_signal: Some(shutdown_tx),
        })
    }

    fn router_service(
        &self,
        service: BoxService<RouterRequest, RouterResponse, BoxError>,
    ) -> BoxService<RouterRequest, RouterResponse, BoxError> {
        let config = self.config.clone();
        let report_sender = self.agent.sender.clone();

        ServiceBuilder::new()
            .map_future_with_context(
                move |req: &RouterRequest| {
                    Self::populate_context(config.clone(), req);
                    req.context.clone()
                },
                move |ctx: Context, fut| {
                    let start = Instant::now();
                    let sender = report_sender.clone();

                    async move {
                        let operation_context = ctx
                            .get::<_, OperationContext>(OPERATION_CONTEXT)
                            .unwrap_or_default()
                            .unwrap();

                        if operation_context.dropped {
                            let result: Result<RouterResponse, BoxError> = fut.await;
                            return result;
                        }

                        let result: Result<RouterResponse, BoxError> = fut.await;
                        let client_name = operation_context.client_name;
                        let client_version = operation_context.client_version;
                        let operation_name = operation_context.operation_name;
                        let operation_body = operation_context.operation_body;
                        let timestamp = operation_context.timestamp;
                        let duration = start.elapsed();

                        match result {
                            Err(e) => {
                                Self::add_report(
                                    sender.clone(),
                                    ExecutionReport {
                                        client_name,
                                        client_version,
                                        timestamp,
                                        duration,
                                        ok: false,
                                        errors: 1,
                                        operation_body,
                                        operation_name,
                                    },
                                );
                                Err(e)
                            }
                            Ok(router_response) => {
                                let is_failure = !router_response.response.status().is_success();
                                Ok(router_response.map(move |response_stream| {
                                    let sender = sender.clone();
                                    let client_name = client_name.clone();
                                    let client_version = client_version.clone();
                                    let operation_body = operation_body.clone();
                                    let operation_name = operation_name.clone();

                                    response_stream
                                        .map(move |response| {
                                            // make sure we send a single report, not for each chunk
                                            let response_has_errors = !response.errors.is_empty();

                                            Self::add_report(
                                                sender.clone(),
                                                ExecutionReport {
                                                    client_name: client_name.clone(),
                                                    client_version: client_version.clone(),
                                                    timestamp,
                                                    duration,
                                                    ok: !is_failure && !response_has_errors,
                                                    errors: response.errors.len(),
                                                    operation_body: operation_body.clone(),
                                                    operation_name: operation_name.clone(),
                                                },
                                            );

                                            response
                                        })
                                        .boxed()
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

impl Drop for UsagePlugin {
    fn drop(&mut self) {
        if let Some(sender) = self.shutdown_signal.take() {
            let _ = sender.send(());
        }
    }
}

register_plugin!("hive", "usage", UsagePlugin);
