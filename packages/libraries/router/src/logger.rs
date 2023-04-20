use once_cell::sync::Lazy;
use std::env;

pub struct Logger {}

static CURRENT_LOG_LEVEL: Lazy<String> =
    Lazy::new(|| env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()));

const LOG_LEVEL_SCORES: [(LogLevel, u8); 5] = [
    ("debug", 5),
    ("info", 4),
    ("warn", 3),
    ("error", 2),
    ("trace", 1),
];

type LogLevel = &'static str;

impl Logger {
    fn find_log_level_score(log_level: &str) -> u8 {
        LOG_LEVEL_SCORES
            .iter()
            .find(|(l, _)| *l == log_level)
            .map(|(_, score)| *score)
            .unwrap()
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
