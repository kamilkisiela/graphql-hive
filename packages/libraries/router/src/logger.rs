use std::env;

pub struct Logger {}

static mut LEVELS_VEC: Option<String> = None;

impl Logger {
    fn should_log(levels: Vec<&str>) -> bool {
        unsafe {
            if LEVELS_VEC == None {
                let log_level = env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
                LEVELS_VEC = Some(log_level);
            }

            if let Some(log_level) = &LEVELS_VEC {
                levels.contains(&log_level.as_str())
            } else {
                false
            }
        }
    }

    pub fn debug(message: &str) {
        if Self::should_log(vec!["debug", "info", "warn", "error"]) {
            println!("DEBUG: {}", message);
        }
    }
    pub fn info(message: &str) {
        if Self::should_log(vec!["info", "warn", "error"]) {
            println!("INFO: {}", message);
        }
    }
    pub fn warn(message: &str) {
        if Self::should_log(vec!["warn", "error"]) {
            println!("WARNING: {}", message);
        }
    }
    pub fn trace(message: &str) {
        if Self::should_log(vec!["debug", "info", "error", "trace"]) {
            println!("TRACE: {}", message);
        }
    }
    pub fn error(message: &str) {
        if Self::should_log(vec!["debug", "error"]) {
            println!("ERROR: {}", message);
        }
    }
}
