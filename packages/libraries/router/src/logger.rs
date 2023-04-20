use std::env;

pub struct Logger {}

static mut LEVELS_VEC: Option<Vec<String>> = None;

impl Logger {
    fn should_log(level: &str) -> bool {
        unsafe {
            if LEVELS_VEC == None {
                let rust_log = env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
                let levels_vec: Vec<String> =
                    rust_log.split(",").map(|e| e.trim().to_string()).collect();

                LEVELS_VEC = Some(levels_vec.clone());
            }

            if let Some(levels_vec) = &LEVELS_VEC {
                levels_vec.contains(&level.to_string())
            } else {
                false
            }
        }
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
