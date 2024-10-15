use std::time::{Instant, SystemTime, UNIX_EPOCH};

#[cfg(feature = "axum")]
pub mod axum;

#[derive(Clone, Debug)]
pub struct GraphQLHiveContext {
    pub(crate) client_name: Option<String>,
    pub(crate) client_version: Option<String>,
    pub(crate) timestamp: u64,
}

impl GraphQLHiveContext {
    pub fn new(client_name: Option<String>, client_version: Option<String>) -> Self {
        Self {
            client_name,
            client_version,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_else(|err| {
                    println!("System time error: {}", err);
                    std::time::Duration::from_secs(0)
                })
                .as_millis() as u64,
        }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct HiveInternalContext {
    pub(crate) start: Instant,
    pub(crate) operation_name: Option<String>,
    pub(crate) operation_body: String,
}
