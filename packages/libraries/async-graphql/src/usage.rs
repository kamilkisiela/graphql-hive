use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use derive_builder::Builder;
use graphql_hive_core::agent::{ExecutionReport, UsageAgent};
use rand::Rng;

use crate::context::{GraphQLHiveContext, HiveInternalContext};

#[derive(Clone, Debug, Builder)]
pub struct UsageConfig {
    /// Default: true
    #[builder(default = "true")]
    pub enabled: bool,
    /// Token to authenticate with GraphQL Hive
    /// Default: HIVE_TOKEN environment variable
    #[builder(
        default = "::std::env::var(\"HIVE_TOKEN\").expect(\"HIVE_TOKEN environment variable not found\")"
    )]
    pub token: String,
    /// Endpoint to send usage reports to
    /// Default: HIVE_ENDPOINT environment variable if available, otherwise https://app.graphql-hive.com/usage
    #[builder(
        default = "::std::env::var(\"HIVE_ENDPOINT\").unwrap_or_else(|_| \"https://app.graphql-hive.com/usage\".to_string())"
    )]
    pub endpoint: String,
    /// Sample rate to determine sampling.
    /// 0.0 = 0% chance of being sent
    /// 1.0 = 100% chance of being sent.
    /// Default: 1.0
    #[builder(default = "1.0")]
    pub sample_rate: f64,
    /// A list of operations (by name) to be ignored by GraphQL Hive.
    #[builder(default)]
    pub exclude: Vec<String>,
    /// A maximum number of operations to hold in a buffer before sending to GraphQL Hive
    /// Default: 1000
    #[builder(default = "1000")]
    pub buffer_size: usize,
    /// A timeout for only the connect phase of a request to GraphQL Hive
    /// Unit: seconds
    /// Default: 5 (s)
    #[builder(default = "5")]
    pub connect_timeout: u64,
    /// A timeout for the entire request to GraphQL Hive
    /// Unit: seconds
    /// Default: 15 (s)
    #[builder(default = "15")]
    pub request_timeout: u64,
    /// Accept invalid SSL certificates
    /// Default: false
    #[builder(default = "false")]
    pub accept_invalid_certs: bool,
}

pub(crate) struct UsageReporter {
    config: UsageConfig,
    agent: Arc<Mutex<Option<UsageAgent>>>,
}

impl UsageReporter {
    pub(crate) fn new(config: UsageConfig) -> Self {
        UsageReporter {
            config,
            agent: Arc::new(Mutex::new(None)),
        }
    }

    pub(crate) fn prepare_agent<F: FnOnce() -> String>(&self, gen_schema: F) {
        if !self.config.enabled {
            return;
        }

        if let Ok(mut agent) = self.agent.lock() {
            if agent.is_none() {
                *agent = Some(UsageAgent::new(
                    gen_schema(),
                    self.config.token.clone(),
                    self.config.endpoint.clone(),
                    self.config.buffer_size,
                    self.config.connect_timeout,
                    self.config.request_timeout,
                    self.config.accept_invalid_certs,
                ))
            }
        }
    }

    pub(crate) async fn process(
        &self,
        public_ctx: GraphQLHiveContext,
        internal_ctx: HiveInternalContext,
        duration: Duration,
        ok: bool,
        errors: usize,
    ) -> Option<()> {
        let lock = self.agent.lock().ok()?;
        let agent = lock.as_ref()?;
        let mut rng = rand::thread_rng();
        let sampled = rng.gen::<f64>() < self.config.sample_rate;
        let excluded = match &internal_ctx.operation_name {
            Some(name) => self.config.exclude.contains(name),
            None => false,
        };
        let dropped = !self.config.enabled || !sampled || excluded;
        if dropped {
            tracing::debug!(
                "Dropping operation (phase: SAMPLING): {}",
                internal_ctx
                    .operation_name
                    .clone()
                    .unwrap_or_else(|| "anonymous".to_string())
            );
            return None;
        }

        try_add_report(
            agent,
            ExecutionReport {
                client_name: public_ctx.client_name,
                client_version: public_ctx.client_version,
                timestamp: public_ctx.timestamp,
                duration,
                ok,
                errors,
                operation_body: internal_ctx.operation_body,
                operation_name: internal_ctx.operation_name,
            },
        );

        Some(())
    }
}

fn try_add_report(agent: &UsageAgent, execution_report: ExecutionReport) {
    if let Err(e) = agent.add_report(execution_report) {
        tracing::error!("Error adding report: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_field_is_optional() {
        // UsageConfig::token reads the environment variable HIVE_TOKEN
        std::env::set_var("HIVE_TOKEN", "token");
        UsageConfigBuilder::create_empty().build().unwrap();
    }
}
