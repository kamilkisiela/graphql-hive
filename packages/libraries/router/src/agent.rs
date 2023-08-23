use crate::registry_logger::Logger;

use super::graphql::OperationProcessor;
use graphql_parser::schema::{parse_schema, Document};
use serde::Serialize;
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
};
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::Duration;

static COMMIT: Option<&'static str> = option_env!("GITHUB_SHA");

#[derive(Serialize, Debug)]
pub struct Report {
    size: usize,
    map: HashMap<String, OperationMapRecord>,
    operations: Vec<Operation>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Debug)]
struct OperationMapRecord {
    operation: String,
    operationName: Option<String>,
    fields: Vec<String>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Debug)]
struct Operation {
    operationMapKey: String,
    timestamp: u64,
    execution: Execution,
    metadata: Option<Metadata>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Debug)]
struct Execution {
    ok: bool,
    duration: u128,
    errorsTotal: usize,
}

#[derive(Serialize, Debug)]
struct Metadata {
    client: Option<ClientInfo>,
}

#[derive(Serialize, Debug)]
struct ClientInfo {
    name: Option<String>,
    version: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ExecutionReport {
    pub client_name: Option<String>,
    pub client_version: Option<String>,
    pub timestamp: u64,
    pub duration: Duration,
    pub ok: bool,
    pub errors: usize,
    pub operation_body: String,
    pub operation_name: Option<String>,
}

#[derive(Debug, Clone)]
pub struct State {
    buffer: VecDeque<ExecutionReport>,
    schema: Document<'static, String>,
}

impl State {
    fn new(schema: Document<'static, String>) -> Self {
        Self {
            buffer: VecDeque::new(),
            schema,
        }
    }

    pub fn push(&mut self, report: ExecutionReport) {
        self.buffer.push_back(report);
    }

    pub fn drain(&mut self) -> Vec<ExecutionReport> {
        self.buffer.drain(0..).collect::<Vec<ExecutionReport>>()
    }
}

#[derive(Clone)]
pub struct UsageAgent {
    token: String,
    endpoint: String,
    accept_invalid_certs: bool,
    /// We need the Arc wrapper to be able to clone the agent while preserving multiple mutable reference to processor
    /// We also need the Mutex wrapper bc we cannot borrow data in an `Arc` as mutable
    pub state: Arc<tokio::sync::Mutex<State>>,
    processor: Arc<tokio::sync::Mutex<OperationProcessor>>,
}

fn non_empty_string(value: Option<String>) -> Option<String> {
    match value {
        Some(value) => match value.is_empty() {
            true => None,
            false => Some(value),
        },
        None => None,
    }
}

impl UsageAgent {
    pub async fn new(
        schema: String,
        token: String,
        endpoint: String,
        accept_invalid_certs: bool,
    ) -> Self {
        let schema = parse_schema::<String>(&schema)
            .expect("Failed to parse schema")
            .into_static();
        let state = Arc::new(AsyncMutex::new(State::new(schema)));
        let processor = Arc::new(AsyncMutex::new(OperationProcessor::new()));

        let agent = Self {
            state,
            processor,
            endpoint,
            token,
            accept_invalid_certs,
        };

        let agent_clone = agent.clone();

        tokio::task::spawn(async move {
            let logger = Logger::new();

            let mut consecutive_sec_no_flush_count = 0.0;

            loop {
                let state_lock = agent_clone.state.lock().await;
                let buffer_size = state_lock.buffer.len();
                // drop the `state_lock` early, as soon as we get the buffer_size and not througout the scope of the loop
                drop(state_lock);

                if buffer_size >= 1000 || consecutive_sec_no_flush_count >= 10.0 {
                    let mut inner_agent_clone = agent_clone.clone();
                    let child_task = tokio::task::spawn(async move {
                        inner_agent_clone.flush().await;
                    });

                    let result = child_task.await;

                    if result.is_err() {
                        logger.error("A panic occurred inside the flush task, but it was caught and the loop will continue.");
                        logger.error(&result.err().unwrap().to_string());
                    }

                    consecutive_sec_no_flush_count = 0.0;
                } else {
                    consecutive_sec_no_flush_count += 0.1;
                }

                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        });

        agent
    }

    async fn produce_report(&mut self, reports: Vec<ExecutionReport>) -> Report {
        let mut report = Report {
            size: 0,
            map: HashMap::new(),
            operations: Vec::new(),
        };

        // iterate over reports and check if they are valid
        for op in reports {
            let operation = self
                .processor
                .lock()
                .await
                .process(&op.operation_body, &self.state.lock().await.schema);
            match operation {
                Err(e) => {
                    tracing::warn!(
                        "Dropping operation \"{}\" (phase: PROCESSING): {}",
                        op.operation_name
                            .clone()
                            .or_else(|| Some("anonymous".to_string()))
                            .unwrap(),
                        e
                    );
                    continue;
                }
                Ok(operation) => {
                    match operation {
                        Some(operation) => {
                            let hash = operation.hash;
                            report.operations.push(Operation {
                                operationMapKey: hash.clone(),
                                timestamp: op.timestamp,
                                execution: Execution {
                                    ok: op.ok,
                                    duration: op.duration.as_nanos(),
                                    errorsTotal: op.errors,
                                },
                                metadata: Some(Metadata {
                                    client: Some(ClientInfo {
                                        name: non_empty_string(op.client_name),
                                        version: non_empty_string(op.client_version),
                                    }),
                                }),
                            });
                            if !report.map.contains_key(&hash) {
                                report.map.insert(
                                    hash,
                                    OperationMapRecord {
                                        operation: operation.operation,
                                        operationName: non_empty_string(op.operation_name),
                                        fields: operation.coordinates,
                                    },
                                );
                            }
                            report.size += 1;
                        }
                        None => {
                            tracing::debug!("Dropping operation (phase: PROCESSING): probably introspection query");
                        }
                    }
                }
            }
        }

        report
    }

    pub async fn add_report(&mut self, execution_report: ExecutionReport) {
        self.state.lock().await.push(execution_report);
    }

    pub async fn send_report(&self, report: Report, buffer_size: usize) -> Result<(), String> {
        const DELAY_BETWEEN_TRIES: Duration = Duration::from_millis(500);
        const MAX_TRIES: u8 = 3;

        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(self.accept_invalid_certs)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|err| err.to_string())?;
        let mut error_message =
            "Unexpected error: Sending the report has failed for 3 consecutive tries!".to_string();

        for try_num in 0..MAX_TRIES {
            tracing::debug!("Sending {} Reports, try number: {try_num}", buffer_size);

            let resp = client
                .post(self.endpoint.clone())
                .header(
                    reqwest::header::AUTHORIZATION,
                    format!("Bearer {}", self.token.clone()),
                )
                .header(
                    reqwest::header::USER_AGENT,
                    format!("hive-apollo-router/{}", COMMIT.unwrap_or_else(|| "local")),
                )
                .json(&report)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            match resp.status() {
                reqwest::StatusCode::OK => {
                    return Ok(());
                }
                reqwest::StatusCode::BAD_REQUEST => {
                    return Err("Token is missing".to_string());
                }
                reqwest::StatusCode::FORBIDDEN => {
                    return Err("No access".to_string());
                }
                _ => {
                    error_message = format!(
                        "Could not send usage report: ({}) {}",
                        resp.status().as_str(),
                        resp.text().await.unwrap_or_default()
                    );
                }
            }

            tokio::time::sleep(DELAY_BETWEEN_TRIES).await;
        }

        Err(error_message)
    }

    pub async fn flush(&mut self) {
        let mut state_lock = self.state.lock().await;
        let execution_reports = state_lock.drain();
        drop(state_lock); // Drop the lock immediately after acquiring and draining, so adding reports isn't blocked while flushing.

        let size = execution_reports.len();
        if size > 0 {
            let report = self.produce_report(execution_reports).await;
            match self.send_report(report, size).await {
                Ok(_) => tracing::debug!("Reported {} operations", size),
                Err(e) => tracing::error!("{}", e),
            }
        }
    }
}
