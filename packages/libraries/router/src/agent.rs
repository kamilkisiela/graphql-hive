use super::graphql::OperationProcessor;
use graphql_parser::schema::{parse_schema, Document};
use reqwest::Client;
use serde::Serialize;
use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::sync::Mutex as AsyncMutex;

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

    pub fn push(&mut self, report: ExecutionReport) -> usize {
        self.buffer.push_back(report);
        self.buffer.len()
    }

    pub fn drain(&mut self) -> Vec<ExecutionReport> {
        self.buffer.drain(0..).collect::<Vec<ExecutionReport>>()
    }
}

#[derive(Clone)]
pub struct UsageAgent {
    token: String,
    buffer_size: usize,
    endpoint: String,
    /// We need the Arc wrapper to be able to clone the agent while preserving multiple mutable reference to processor
    /// We also need the Mutex wrapper bc we cannot borrow data in an `Arc` as mutable
    pub state: Arc<Mutex<State>>,
    processor: Arc<Mutex<OperationProcessor>>,
    client: Client,
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
    pub fn new(
        schema: String,
        token: String,
        endpoint: String,
        buffer_size: usize,
        accept_invalid_certs: bool,
    ) -> Self {
        let schema = parse_schema::<String>(&schema)
            .expect("Failed to parse schema")
            .into_static();
        let state = Arc::new(Mutex::new(State::new(schema)));
        let processor = Arc::new(Mutex::new(OperationProcessor::new()));

        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(accept_invalid_certs)
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|err| err.to_string())
            .expect("Couldn't instantiate the http client for reports sending!");

        let agent = Self {
            state,
            processor,
            endpoint,
            token,
            buffer_size,
            client,
        };

        let agent_for_interval = AsyncMutex::new(Arc::new(agent.clone()));

        tokio::task::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;

                let agent_ref = agent_for_interval.lock().await.clone();
                tokio::task::spawn(async move {
                    agent_ref.flush().await;
                });
            }
        });

        agent
    }

    fn produce_report(&self, reports: Vec<ExecutionReport>) -> Report {
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
                .expect("Unable to acquire the OperationProcessor in produce_report")
                .process(
                    &op.operation_body,
                    &self
                        .state
                        .lock()
                        .expect("Unable to acquire State in produce_report")
                        .schema,
                );
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

    pub fn add_report(&self, execution_report: ExecutionReport) {
        let size = self
            .state
            .lock()
            .expect("Unable to acquire State in add_report")
            .push(execution_report);

        self.flush_if_full(size);
    }

    pub async fn send_report(&self, report: Report) -> Result<(), String> {
        const DELAY_BETWEEN_TRIES: Duration = Duration::from_millis(500);
        const MAX_TRIES: u8 = 3;

        let mut error_message = "Unexpected error".to_string();

        for _ in 0..MAX_TRIES {
            let resp = self
                .client
                .post("http://localhost:58080/delay/5".to_string())
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

    pub fn flush_if_full(&self, size: usize) {
        if size >= self.buffer_size {
            let cloned_self = self.clone();
            tokio::task::spawn(async move {
                cloned_self.flush().await;
            });
        }
    }

    pub async fn flush(&self) {
        let execution_reports = self
            .state
            .lock()
            .expect("Unable to acquire State in flush")
            .drain();
        let size = execution_reports.len();

        if size > 0 {
            let report = self.produce_report(execution_reports);
            match self.send_report(report).await {
                Ok(_) => tracing::debug!("Reported {} operations", size),
                Err(e) => tracing::error!("{}", e),
            }
        }
    }
}
