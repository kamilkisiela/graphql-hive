use super::graphql::OperationProcessor;
use graphql_parser::schema::{parse_schema, Document};
use serde::Serialize;
use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
    time::Duration,
};

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
    endpoint: String,
    buffer_size: usize,
    accept_invalid_certs: bool,
    /// We need the Arc wrapper to be able to clone the agent while preserving multiple mutable reference to processor
    /// We also need the Mutex wrapper bc we cannot borrow data in an `Arc` as mutable
    pub state: Arc<Mutex<State>>,
    processor: Arc<Mutex<OperationProcessor>>,
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

        let agent = Self {
            state,
            processor,
            endpoint,
            token,
            buffer_size,
            accept_invalid_certs,
        };

        let mut agent_for_interval = agent.clone();

        // TODO: make this working
        // tokio::task::spawn(async move {
        //     if let Some(shutdown_signal) = shutdown_signal {
        //         tracing::info!("waiting for shutdown signal");
        //         shutdown_signal.await.expect("shutdown signal");
        //         tracing::info!("Flushing reports because of shutdown signal");
        //         // agent_for_shutdown_signal.clone().flush().await;
        //         // tracing::info!("Flushed because of shutdown");
        //     }

        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(5));
            agent_for_interval.flush();
        });

        agent
    }

    fn produce_report(&mut self, reports: Vec<ExecutionReport>) -> Report {
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
                            tracing::info!("Dropping operation (phase: PROCESSING): probably introspection query");
                        }
                    }
                }
            }
        }

        report
    }

    pub fn add_report(&mut self, execution_report: ExecutionReport) {
        let size = self
            .state
            .lock()
            .expect("Unable to acquire State in add_report")
            .push(execution_report);
        self.flush_if_full(size);
    }

    pub fn send_report(&self, report: Report) -> Result<(), String> {
        const DELAY_BETWEEN_TRIES: Duration = Duration::from_millis(500);
        const MAX_TRIES: u8 = 3;

        let client = reqwest::blocking::Client::builder()
            .danger_accept_invalid_certs(self.accept_invalid_certs)
            .build()
            .map_err(|err| err.to_string())?;
        let mut error_message = "Unexpected error".to_string();

        for _ in 0..MAX_TRIES {
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
                        resp.text().unwrap_or_default()
                    );
                }
            }
            std::thread::sleep(DELAY_BETWEEN_TRIES);
        }

        Err(error_message)
    }

    pub fn flush_if_full(&mut self, size: usize) {
        if size >= self.buffer_size {
            self.flush();
        }
    }

    pub fn flush(&mut self) {
        let execution_reports = self
            .state
            .lock()
            .expect("Unable to acquire State in flush")
            .drain();
        let size = execution_reports.len();

        if size > 0 {
            let report = self.produce_report(execution_reports);
            match self.send_report(report) {
                Ok(_) => tracing::debug!("Reported {} operations", size),
                Err(e) => tracing::error!("{}", e),
            }
        }
    }
}
