use once_cell::sync::Lazy;
use std::env;

pub struct Logger {}

static CURRENT_LOG_LEVEL: Lazy<String> =
    Lazy::new(|| env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()));

/// The order of this Array's items is important. The higher the index, the more logs it includes.
///
///
/// ### Example
/// When log level is equal to `info`, it will include `info` and all of the previous indices like `warn`, `error`, and `trace`.
const LOG_LEVEL_SCORES: [LogLevel; 5] = ["trace", "error", "warn", "info", "debug"];

type LogLevel = &'static str;

impl Logger {
    fn find_log_level_score(log_level: &str) -> usize {
        LOG_LEVEL_SCORES
            .iter()
            .position(|&x| x == log_level)
            .expect("Invalid log level")
    }

    fn should_log(level: &str) -> bool {
        Self::find_log_level_score(CURRENT_LOG_LEVEL.as_str()) >= Self::find_log_level_score(level)
    }

    pub fn debug(message: &str) {
        if Self::should_log("debug") {
            println!("DEBUG: {}", message);
        }
    }
    pub fn info(message: &str) {
        if Self::should_log("info") {
            println!("INFO: {}", message);
        }
    }
    pub fn warn(message: &str) {
        if Self::should_log("warn") {
            println!("WARNING: {}", message);
        }
    }
    pub fn trace(message: &str) {
        if Self::should_log("trace") {
            println!("TRACE: {}", message);
        }
    }
    pub fn error(message: &str) {
        if Self::should_log("error") {
            println!("ERROR: {}", message);
        }
    }
}
